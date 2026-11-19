import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, type Content } from '@google/genai';
import express, { type NextFunction, type Request, type Response } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_PATH = path.resolve(DATA_DIR, 'store.json');
const FIREBASE_CONFIG_PATH = path.resolve(__dirname, 'firebase-applet-config.json');

interface FirebaseAppletConfig {
  projectId: string;
  appId?: string;
  apiKey?: string;
  firestoreDatabaseId?: string;
}

interface StoredUser {
  id: number;
  uid?: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  createdAt: string;
}

interface StoreData {
  sessionSecret: string;
  users: StoredUser[];
}

interface UserSessionPayload {
  sub: string;
  role: 'user';
  name: string;
  email: string;
  exp: number;
}

interface VerifiedFirebaseClaims {
  uid: string;
  email: string;
  emailVerified: boolean;
  rawToken: string;
}

interface AuthenticatedRequest extends Request {
  userAuth?: UserSessionPayload;
  firebaseAdmin?: VerifiedFirebaseClaims;
}

function loadFirebaseConfig(): FirebaseAppletConfig {
  const raw = fs.readFileSync(FIREBASE_CONFIG_PATH, 'utf8');
  return JSON.parse(raw) as FirebaseAppletConfig;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = crypto.scryptSync(password, salt, 64);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

function safeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function getStableFallbackSecret(): string {
  try {
    const cfg = loadFirebaseConfig();
    return crypto
      .createHmac('sha256', cfg.apiKey || cfg.projectId)
      .update(`${cfg.projectId}:${cfg.appId || ''}:hh-session`)
      .digest('hex');
  } catch {
    return crypto.randomBytes(32).toString('hex');
  }
}

function ensureStore(): StoreData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STORE_PATH)) {
    const initial: StoreData = {
      sessionSecret: process.env.SESSION_SECRET || getStableFallbackSecret(),
      users: [],
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }

  const raw = fs.readFileSync(STORE_PATH, 'utf8');
  const parsed = JSON.parse(raw) as Partial<StoreData>;

  let mutated = false;
  if (!parsed.sessionSecret) {
    parsed.sessionSecret = process.env.SESSION_SECRET || getStableFallbackSecret();
    mutated = true;
  }
  if (!Array.isArray(parsed.users)) {
    parsed.users = [];
    mutated = true;
  }

  const data: StoreData = {
    sessionSecret: parsed.sessionSecret,
    users: parsed.users,
  };
  if (mutated) {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
  }
  return data;
}

function readStore(): StoreData {
  return ensureStore();
}

function writeStore(data: StoreData): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || readStore().sessionSecret;
}

function signUserToken(payload: UserSessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyUserToken(token: string): UserSessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');

  if (!safeStringEqual(sig, expectedSig)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as UserSessionPayload;
    if (!payload.exp || Date.now() > payload.exp || payload.role !== 'user') {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// Cache Google's public x509 certificates for Firebase ID token verification
let cachedCerts: Record<string, string> = {};
let certsExpiresAt = 0;

async function getGoogleCerts(): Promise<Record<string, string>> {
  if (Date.now() < certsExpiresAt && Object.keys(cachedCerts).length > 0) {
    return cachedCerts;
  }

  const res = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!res.ok) {
    throw new Error('Unable to fetch Firebase public certificates.');
  }

  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  cachedCerts = (await res.json()) as Record<string, string>;
  certsExpiresAt = Date.now() + maxAgeSec * 1000;
  return cachedCerts;
}

async function verifyFirebaseIdToken(
  token: string
): Promise<VerifiedFirebaseClaims | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;
  if (!headerB64 || !payloadB64 || !signatureB64) return null;

  let header: { alg?: string; kid?: string };
  let claims: {
    iss?: string;
    aud?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    email?: string;
    email_verified?: boolean;
  };

  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (header.alg !== 'RS256' || !header.kid) {
    return null;
  }

  const { projectId } = loadFirebaseConfig();
  const nowSec = Math.floor(Date.now() / 1000);
  if (
    claims.aud !== projectId ||
    claims.iss !== `https://securetoken.google.com/${projectId}` ||
    !claims.sub ||
    !claims.exp ||
    claims.exp <= nowSec ||
    (claims.iat && claims.iat > nowSec + 300)
  ) {
    return null;
  }

  const certs = await getGoogleCerts();
  const certPem = certs[header.kid];
  if (!certPem) {
    return null;
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();

  const signature = Buffer.from(signatureB64, 'base64url');
  if (!verifier.verify(certPem, signature)) {
    return null;
  }

  return {
    uid: claims.sub,
    email: String(claims.email ?? '').toLowerCase(),
    emailVerified: Boolean(claims.email_verified),
    rawToken: token,
  };
}

async function checkAdminDocWithCallerToken(
  uid: string,
  idToken: string
): Promise<boolean> {
  const { projectId, firestoreDatabaseId } = loadFirebaseConfig();
  const dbId = firestoreDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/${encodeURIComponent(dbId)}/documents/admins/${encodeURIComponent(
    uid
  )}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) {
    return false;
  }

  const docJson = (await res.json()) as {
    fields?: { role?: { stringValue?: string } };
  };
  return docJson.fields?.role?.stringValue === 'admin';
}

function getFirestoreDocumentsBaseUrl(): string {
  const { projectId, firestoreDatabaseId } = loadFirebaseConfig();
  const dbId = firestoreDatabaseId || '(default)';
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/${encodeURIComponent(dbId)}/documents`;
}

function getPhoneHash(phone: string): string {
  const { projectId } = loadFirebaseConfig();
  return crypto.createHash('sha256').update(`${projectId}:phone:${phone}`).digest('hex');
}

function getPhoneCipherKey(): Buffer {
  const cfg = loadFirebaseConfig();
  return crypto
    .createHash('sha256')
    .update(`${cfg.projectId}:${cfg.appId || ''}:${cfg.apiKey || ''}:phone-cipher`)
    .digest();
}

function encryptEmailForLookup(email: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getPhoneCipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(email, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptEmailFromLookup(cipherText: string): string | null {
  const parts = cipherText.split(':');
  if (parts.length !== 3) return null;
  const [ivHex, tagHex, dataHex] = parts;
  if (!ivHex || !tagHex || !dataHex) return null;
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getPhoneCipherKey(),
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

async function firebaseIdentitySignUp(
  email: string,
  password: string
): Promise<{ uid: string; idToken: string }> {
  const { apiKey } = loadFirebaseConfig();
  if (!apiKey) {
    throw new Error('Firebase API key is missing in configuration.');
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(
      apiKey
    )}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );
  const data = (await res.json()) as {
    localId?: string;
    idToken?: string;
    error?: { message?: string };
  };

  if (!res.ok || !data.localId || !data.idToken) {
    throw new Error(data.error?.message || 'FIREBASE_SIGNUP_FAILED');
  }

  return { uid: data.localId, idToken: data.idToken };
}

async function firebaseIdentitySignIn(
  email: string,
  password: string
): Promise<{ uid: string; idToken: string }> {
  const { apiKey } = loadFirebaseConfig();
  if (!apiKey) {
    throw new Error('Firebase API key is missing in configuration.');
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(
      apiKey
    )}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );
  const data = (await res.json()) as {
    localId?: string;
    idToken?: string;
    error?: { message?: string };
  };

  if (!res.ok || !data.localId || !data.idToken) {
    throw new Error(data.error?.message || 'INVALID_LOGIN_CREDENTIALS');
  }

  return { uid: data.localId, idToken: data.idToken };
}

async function createFirestoreUserProfile(
  uid: string,
  idToken: string,
  user: { id: number; name: string; email: string; phone: string; createdAt: string }
): Promise<void> {
  const baseUrl = getFirestoreDocumentsBaseUrl();
  const res = await fetch(
    `${baseUrl}/users?documentId=${encodeURIComponent(uid)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          id: { integerValue: String(user.id) },
          uid: { stringValue: uid },
          name: { stringValue: user.name },
          email: { stringValue: user.email },
          phone: { stringValue: user.phone },
          role: { stringValue: 'user' },
          createdAt: { stringValue: user.createdAt },
        },
      }),
    }
  );
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Failed to persist user profile in Firestore: ${errBody}`);
  }
}

async function getFirestoreUserProfile(
  uid: string,
  idToken: string
): Promise<StoredUser | null> {
  const baseUrl = getFirestoreDocumentsBaseUrl();
  const res = await fetch(`${baseUrl}/users/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) {
    return null;
  }

  const docJson = (await res.json()) as {
    fields?: {
      id?: { integerValue?: string; doubleValue?: number };
      name?: { stringValue?: string };
      email?: { stringValue?: string };
      phone?: { stringValue?: string };
      role?: { stringValue?: string };
      createdAt?: { stringValue?: string };
    };
  };

  const fields = docJson.fields;
  if (!fields || fields.role?.stringValue !== 'user') {
    return null;
  }

  const rawId = fields.id?.integerValue
    ? Number(fields.id.integerValue)
    : Number(fields.id?.doubleValue ?? Date.now());

  return {
    id: Number.isFinite(rawId) ? rawId : Date.now(),
    uid,
    name: String(fields.name?.stringValue ?? ''),
    email: String(fields.email?.stringValue ?? '').toLowerCase(),
    phone: String(fields.phone?.stringValue ?? ''),
    passwordHash: '',
    createdAt: String(fields.createdAt?.stringValue ?? new Date().toISOString()),
  };
}

async function createFirestorePhoneLookup(
  phone: string,
  email: string,
  uid: string,
  idToken: string,
  createdAt: string
): Promise<void> {
  const phoneHash = getPhoneHash(phone);
  const cipherEmail = encryptEmailForLookup(email);
  const baseUrl = getFirestoreDocumentsBaseUrl();

  const res = await fetch(
    `${baseUrl}/phoneLookups?documentId=${encodeURIComponent(phoneHash)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          ownerUid: { stringValue: uid },
          cipherEmail: { stringValue: cipherEmail },
          createdAt: { stringValue: createdAt },
        },
      }),
    }
  );
  if (!res.ok && res.status !== 409) {
    const errBody = await res.text();
    console.warn('Phone lookup write warning:', res.status, errBody);
  }
}

async function getEmailByPhoneFromFirestore(phone: string): Promise<string | null> {
  const phoneHash = getPhoneHash(phone);
  const baseUrl = getFirestoreDocumentsBaseUrl();
  const res = await fetch(
    `${baseUrl}/phoneLookups/${encodeURIComponent(phoneHash)}`
  );
  if (!res.ok) {
    return null;
  }

  const docJson = (await res.json()) as {
    fields?: { cipherEmail?: { stringValue?: string } };
  };
  const cipher = docJson.fields?.cipherEmail?.stringValue;
  if (!cipher) return null;
  return decryptEmailFromLookup(cipher);
}

function isHttpsRequest(req: Request): boolean {
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return req.secure || proto.includes('https');
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';');
    for (const part of cookies) {
      const [name, ...rest] = part.trim().split('=');
      if (name === 'hh_session') {
        return decodeURIComponent(rest.join('='));
      }
    }
  }

  return null;
}

function setUserCookie(req: Request, res: Response, token: string): void {
  const https = isHttpsRequest(req);
  const cookieParts = [
    `hh_session=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    https ? 'SameSite=None' : 'SameSite=Lax',
    `Max-Age=${60 * 60 * 12}`,
  ];
  if (https || IS_PRODUCTION) {
    cookieParts.push('Secure');
  }
  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

function clearUserCookie(req: Request, res: Response): void {
  const https = isHttpsRequest(req);
  const cookieParts = [
    'hh_session=',
    'Path=/',
    'HttpOnly',
    https ? 'SameSite=None' : 'SameSite=Lax',
    'Max-Age=0',
  ];
  if (https || IS_PRODUCTION) {
    cookieParts.push('Secure');
  }
  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

function requireUserAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const payload = verifyUserToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid.' });
    return;
  }
  req.userAuth = payload;
  next();
}

async function requireFirebaseAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Firebase authentication token required.' });
    return;
  }

  const idToken = authHeader.slice(7).trim();
  try {
    const claims = await verifyFirebaseIdToken(idToken);
    if (!claims) {
      res.status(401).json({ error: 'Invalid or expired Firebase ID token.' });
      return;
    }

    const hasAdminDoc = await checkAdminDocWithCallerToken(claims.uid, idToken);

    if (!hasAdminDoc) {
      res.status(403).json({
        error: 'Access denied. Administrator role document required in Firestore.',
      });
      return;
    }

    req.firebaseAdmin = claims;
    next();
  } catch {
    res.status(401).json({ error: 'Unable to verify Firebase credentials.' });
  }
}

function sanitizeUser(user: StoredUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    createdAt: user.createdAt,
  };
}

type ChatRoleId = 'hygiene-coach' | 'nutrition-guide' | 'quick-helper';

const CHAT_ROLES: Record<
  ChatRoleId,
  { model: string; systemInstruction: string }
> = {
  'hygiene-coach': {
    model: 'gemini-3.1-flash-lite',
    systemInstruction:
      'You are the Personal Hygiene & Sanitation Coach for the Health & Hygiene Awareness portal. Provide practical, encouraging, evidence-aligned everyday guidance on handwashing (20-second soap method), bathing, oral care, clean surroundings, safe drinking water, and infection prevention. Keep responses clear, structured, and under 220 words unless more detail is requested. Never diagnose medical conditions or prescribe treatments; remind users to consult a qualified doctor for medical symptoms.',
  },
  'nutrition-guide': {
    model: 'gemini-3.1-flash-lite',
    systemInstruction:
      'You are the Healthy Nutrition & Hydration Guide for the Health & Hygiene Awareness portal. Help users plan balanced meals with seasonal fruits, leafy vegetables, whole grains, clean proteins, food-washing hygiene, and daily hydration (around 8 glasses of clean water). Keep answers practical, supportive, and concise (under 220 words unless asked for a meal plan). Do not give clinical medical nutrition therapy.',
  },
  'quick-helper': {
    model: 'gemini-3.1-flash-lite',
    systemInstruction:
      'You are the Fast Habit & Prevention Helper for the Health & Hygiene Awareness portal. Give direct, accurate, ultra-concise answers in 2 to 4 short sentences or 3 to 5 brief bullet points focused on daily hygiene habits, handwashing, hydration, or food cleanliness. Avoid medical diagnosis.',
  },
};

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function sendChatWithRetry(
  ai: GoogleGenAI,
  model: string,
  systemInstruction: string,
  history: Content[],
  message: string
): Promise<string> {
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const chat = ai.chats.create({
        model,
        history,
        config: {
          systemInstruction,
        },
      });
      const response = await chat.sendMessage({ message });
      const text = response.text?.trim();
      if (!text) {
        throw new Error('The assistant returned an empty response.');
      }
      return text;
    } catch (err) {
      lastError = err;
      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? Number((err as { status?: unknown }).status)
          : 0;
      const isRetryable = status === 429 || (status >= 500 && status < 600);
      if (!isRetryable || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * Math.pow(2, attempt - 1)));
    }
  }

  throw lastError;
}

async function startServer() {
  ensureStore();

  const app = express();
  app.use(express.json());

  // User Registration (persists permanently in Firebase Auth + Firestore + local cache)
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    const body = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      password?: string;
    };

    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const phone = String(body.phone ?? '').trim();
    const password = String(body.password ?? '');

    if (!name || name.length > 120) {
      res
        .status(400)
        .json({ error: 'Please enter a valid full name (max 120 characters).' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 150) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (!/^[0-9]{10}$/.test(phone)) {
      res.status(400).json({ error: 'Enter a valid 10-digit phone number.' });
      return;
    }
    if (password.length < 8) {
      res
        .status(400)
        .json({ error: 'Password must have at least 8 characters.' });
      return;
    }

    const store = readStore();
    const existsLocally = store.users.some(
      (u) => u.email.toLowerCase() === email || u.phone === phone
    );
    if (existsLocally) {
      res
        .status(409)
        .json({ error: 'Email or phone number already registered.' });
      return;
    }

    const existingPhoneEmail = await getEmailByPhoneFromFirestore(phone).catch(
      () => null
    );
    if (existingPhoneEmail) {
      res
        .status(409)
        .json({ error: 'Email or phone number already registered.' });
      return;
    }

    const numericId = Date.now();
    const createdAt = new Date().toISOString();

    try {
      let uid: string;
      let idToken: string;

      try {
        const created = await firebaseIdentitySignUp(email, password);
        uid = created.uid;
        idToken = created.idToken;
      } catch (signUpErr) {
        const signUpCode = signUpErr instanceof Error ? signUpErr.message : '';
        if (signUpCode.includes('EMAIL_EXISTS')) {
          // Check if this is an orphaned Auth account whose /users/{uid} Firestore doc was deleted or missing
          try {
            const signedIn = await firebaseIdentitySignIn(email, password);
            const [existingUserDoc, isExistingAdmin] = await Promise.all([
              getFirestoreUserProfile(signedIn.uid, signedIn.idToken),
              checkAdminDocWithCallerToken(signedIn.uid, signedIn.idToken),
            ]);

            if (isExistingAdmin) {
              res.status(409).json({
                error:
                  'This email belongs to an administrator account. Please use the Admin tab to sign in.',
              });
              return;
            }
            if (existingUserDoc) {
              res.status(409).json({
                error: 'Email or phone number already registered.',
              });
              return;
            }

            uid = signedIn.uid;
            idToken = signedIn.idToken;
          } catch {
            res.status(409).json({
              error: 'Email or phone number already registered.',
            });
            return;
          }
        } else {
          throw signUpErr;
        }
      }

      await createFirestoreUserProfile(uid, idToken, {
        id: numericId,
        name,
        email,
        phone,
        createdAt,
      });
      await createFirestorePhoneLookup(phone, email, uid, idToken, createdAt);

      const newUser: StoredUser = {
        id: numericId,
        uid,
        name,
        email,
        phone,
        passwordHash: hashPassword(password),
        createdAt,
      };
      store.users.push(newUser);
      writeStore(store);

      res.status(201).json({
        message: 'Registration successful! Please login.',
        user: sanitizeUser(newUser),
      });
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code.includes('EMAIL_EXISTS')) {
        res
          .status(409)
          .json({ error: 'Email or phone number already registered.' });
        return;
      }
      if (code.includes('OPERATION_NOT_ALLOWED')) {
        res.status(503).json({
          error:
            'Email/Password registration is not enabled in Firebase Authentication.',
        });
        return;
      }
      console.error('User registration error:', err);
      res.status(500).json({
        error: 'Unable to complete registration right now. Please try again.',
      });
    }
  });

  // User Login (email or 10-digit phone, backed permanently by Firebase Auth + Firestore)
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const body = req.body as { identifier?: string; password?: string };
    const identifier = String(body.identifier ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    if (!identifier || !password) {
      res
        .status(400)
        .json({ error: 'Email/phone number and password are required.' });
      return;
    }

    const store = readStore();
    const isPhoneIdentifier = /^[0-9]{10}$/.test(identifier);

    let resolvedEmail: string | null = isPhoneIdentifier ? null : identifier;
    if (isPhoneIdentifier) {
      const localByPhone = store.users.find((u) => u.phone === identifier);
      if (localByPhone) {
        resolvedEmail = localByPhone.email.toLowerCase();
      } else {
        resolvedEmail = await getEmailByPhoneFromFirestore(identifier).catch(
          () => null
        );
      }
    }

    let matchedProfile: StoredUser | null = null;
    let blockLegacyFallback = false;
    let specificFailure: { status: number; message: string } | null = null;

    if (resolvedEmail) {
      try {
        const { uid, idToken } = await firebaseIdentitySignIn(
          resolvedEmail,
          password
        );
        const fsProfile = await getFirestoreUserProfile(uid, idToken);
        if (fsProfile) {
          matchedProfile = fsProfile;

          // Keep local cache synchronized across restarts
          const nextStore = readStore();
          const idx = nextStore.users.findIndex(
            (u) => u.uid === uid || u.email.toLowerCase() === fsProfile.email
          );
          const cachedRecord: StoredUser = {
            ...fsProfile,
            passwordHash: hashPassword(password),
          };
          if (idx >= 0) {
            nextStore.users[idx] = cachedRecord;
          } else {
            nextStore.users.push(cachedRecord);
          }
          writeStore(nextStore);
        } else {
          // Firebase Auth account exists and password matched, but /users/{uid} is absent
          blockLegacyFallback = true;
          const isAdmin = await checkAdminDocWithCallerToken(uid, idToken).catch(
            () => false
          );
          specificFailure = isAdmin
            ? {
                status: 403,
                message:
                  'This is an administrator account. Please sign in using the Admin tab.',
              }
            : {
                status: 404,
                message:
                  'User profile was not found in the database. Please register on the Register tab to set up your profile.',
              };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('USER_DISABLED')) {
          blockLegacyFallback = true;
          specificFailure = {
            status: 403,
            message: 'This account has been disabled.',
          };
        } else if (msg.includes('TOO_MANY_ATTEMPTS_TRY_LATER')) {
          blockLegacyFallback = true;
          specificFailure = {
            status: 429,
            message:
              'Too many failed login attempts. Please wait a few minutes and try again.',
          };
        } else if (msg.includes('OPERATION_NOT_ALLOWED')) {
          blockLegacyFallback = true;
          specificFailure = {
            status: 503,
            message:
              'Email/Password sign-in is not enabled in Firebase Authentication.',
          };
        }
      }
    }

    // Legacy fallback for any user still only in store.users (migrates silently to Firebase)
    if (!matchedProfile && !blockLegacyFallback) {
      const localMatched = store.users.find(
        (u) => u.email.toLowerCase() === identifier || u.phone === identifier
      );
      if (localMatched && verifyPassword(password, localMatched.passwordHash)) {
        matchedProfile = localMatched;
        try {
          const { uid, idToken } = await firebaseIdentitySignUp(
            localMatched.email.toLowerCase(),
            password
          );
          await createFirestoreUserProfile(uid, idToken, {
            id: localMatched.id,
            name: localMatched.name,
            email: localMatched.email.toLowerCase(),
            phone: localMatched.phone,
            createdAt: localMatched.createdAt,
          });
          await createFirestorePhoneLookup(
            localMatched.phone,
            localMatched.email.toLowerCase(),
            uid,
            idToken,
            localMatched.createdAt
          );
          localMatched.uid = uid;
          writeStore(store);
        } catch {
          // Ignore migration failure if already migrated
        }
      }
    }

    if (!matchedProfile) {
      if (specificFailure) {
        res.status(specificFailure.status).json({ error: specificFailure.message });
        return;
      }
      res
        .status(401)
        .json({ error: 'Invalid email/phone number or password.' });
      return;
    }

    const sessionPayload: UserSessionPayload = {
      sub: String(matchedProfile.id),
      role: 'user',
      name: matchedProfile.name,
      email: matchedProfile.email,
      exp: Date.now() + 12 * 60 * 60 * 1000,
    };

    const token = signUserToken(sessionPayload);
    setUserCookie(req, res, token);

    res.json({
      token,
      session: {
        id: matchedProfile.id,
        name: matchedProfile.name,
        email: matchedProfile.email,
        role: 'user',
      },
    });
  });

  // Verify Current Normal User Session
  app.get('/api/auth/me', requireUserAuth, (req: AuthenticatedRequest, res: Response) => {
    const auth = req.userAuth!;
    const refreshedToken = signUserToken({
      sub: auth.sub,
      role: 'user',
      name: auth.name,
      email: auth.email,
      exp: Date.now() + 12 * 60 * 60 * 1000,
    });
    res.json({
      token: refreshedToken,
      session: {
        id: Number(auth.sub),
        name: auth.name,
        email: auth.email,
        role: 'user',
      },
    });
  });

  // Logout Normal User
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    clearUserCookie(req, res);
    res.json({ ok: true });
  });

  // Firebase-Admin-Protected: Sync/List Registered Users for Firestore Mirror
  app.get(
    '/api/admin/users',
    (req, res, next) => void requireFirebaseAdmin(req, res, next),
    (_req: AuthenticatedRequest, res: Response) => {
      const store = readStore();
      res.json({
        users: store.users.map(sanitizeUser),
      });
    }
  );

  // Firebase-Admin-Protected: Mirror User Profile Updates
  app.patch(
    '/api/admin/users/:id',
    (req, res, next) => void requireFirebaseAdmin(req, res, next),
    (req: AuthenticatedRequest, res: Response) => {
      const userId = Number(req.params.id);
      if (!Number.isFinite(userId)) {
        res.status(400).json({ error: 'Invalid user ID.' });
        return;
      }

      const body = req.body as {
        name?: string;
        email?: string;
        phone?: string;
      };

      const name = String(body.name ?? '').trim();
      const email = String(body.email ?? '').trim().toLowerCase();
      const phone = String(body.phone ?? '').trim();

      if (!name || name.length > 120) {
        res.status(400).json({ error: 'Full name is required (max 120 chars).' });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 150) {
        res.status(400).json({ error: 'Enter a valid email address.' });
        return;
      }
      if (!/^[0-9]{10}$/.test(phone)) {
        res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
        return;
      }

      const store = readStore();
      const index = store.users.findIndex((u) => u.id === userId);
      if (index === -1) {
        res.json({ user: { id: userId, name, email, phone } });
        return;
      }

      const duplicate = store.users.some(
        (u) =>
          u.id !== userId &&
          (u.email.toLowerCase() === email || u.phone === phone)
      );
      if (duplicate) {
        res.status(409).json({
          error: 'Another account already uses this email or mobile number.',
        });
        return;
      }

      store.users[index] = {
        ...store.users[index],
        name,
        email,
        phone,
      };
      writeStore(store);

      res.json({ user: sanitizeUser(store.users[index]) });
    }
  );

  // Firebase-Admin-Protected: Mirror User Deletion
  app.delete(
    '/api/admin/users/:id',
    (req, res, next) => void requireFirebaseAdmin(req, res, next),
    (req: AuthenticatedRequest, res: Response) => {
      const userId = Number(req.params.id);
      if (!Number.isFinite(userId)) {
        res.status(400).json({ error: 'Invalid user ID.' });
        return;
      }

      const store = readStore();
      store.users = store.users.filter((u) => u.id !== userId);
      writeStore(store);
      res.json({ deletedId: userId });
    }
  );

  // Authenticated User Multi-Turn Gemini Chatbot
  app.post('/api/chat', requireUserAuth, async (req: AuthenticatedRequest, res: Response) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    const body = req.body as {
      roleId?: unknown;
      history?: unknown;
      message?: unknown;
    };

    const message = String(body.message ?? '').trim();
    if (!message || message.length > 2000) {
      res.status(400).json({
        error: 'Please enter a message between 1 and 2000 characters.',
      });
      return;
    }

    const requestedRole = String(body.roleId ?? 'hygiene-coach');
    const roleId: ChatRoleId =
      requestedRole === 'nutrition-guide' || requestedRole === 'quick-helper'
        ? requestedRole
        : 'hygiene-coach';
    const roleConfig = CHAT_ROLES[roleId];

    const rawHistory = Array.isArray(body.history) ? body.history : [];
    const sdkHistory: Content[] = [];
    for (const item of rawHistory.slice(-20)) {
      if (typeof item !== 'object' || item === null) continue;
      const entry = item as { role?: unknown; text?: unknown };
      const role = entry.role === 'model' ? 'model' : entry.role === 'user' ? 'user' : null;
      const text = typeof entry.text === 'string' ? entry.text.trim().slice(0, 4000) : '';
      if (!role || !text) continue;

      // Ensure history starts with 'user' and strictly alternates user -> model
      if (sdkHistory.length === 0 && role !== 'user') continue;
      const prevRole = sdkHistory[sdkHistory.length - 1]?.role;
      if (prevRole === role) continue;

      sdkHistory.push({
        role,
        parts: [{ text }],
      });
    }
    // History passed into chats.create must end on a 'model' turn because sendMessage appends a 'user' turn
    if (sdkHistory.length > 0 && sdkHistory[sdkHistory.length - 1].role === 'user') {
      sdkHistory.pop();
    }

    try {
      const reply = await sendChatWithRetry(
        ai,
        roleConfig.model,
        roleConfig.systemInstruction,
        sdkHistory,
        message
      );
      res.json({
        reply,
        model: roleConfig.model,
        roleId,
      });
    } catch (err) {
      console.error('Gemini chat error:', err);
      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? Number((err as { status?: unknown }).status)
          : 500;
      const rawMsg = err instanceof Error ? err.message : 'Unable to generate chat response.';

      if (status === 400 || status === 403 || rawMsg.includes('API_KEY_INVALID')) {
        res.status(status === 403 ? 403 : 400).json({
          error:
            'Unable to authenticate with Gemini API. Please check your GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }
      if (status === 429) {
        res.status(429).json({
          error: 'Chat service is temporarily busy. Please wait a moment and try again.',
        });
        return;
      }

      res.status(502).json({
        error: rawMsg || 'Unable to generate a response right now. Please try again.',
      });
    }
  });

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Health & Hygiene server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
