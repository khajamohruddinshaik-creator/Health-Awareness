import type { AuthSession, ChatRoleId, UserAccount } from '../types/health';
import {
  clearSession,
  getAuthToken,
  saveSession,
  setAuthToken,
} from './storage';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiRequest<T>(
  url: string,
  options: RequestInit = {},
  overrideBearerToken?: string
): Promise<T> {
  const token = overrideBearerToken ?? getAuthToken();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & T;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.error || 'Request failed. Please try again.'
    );
  }

  return data;
}

export async function registerUser(payload: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<{ message: string; user: UserAccount }> {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload: {
  identifier: string;
  password: string;
}): Promise<AuthSession> {
  const data = await apiRequest<{ token: string; session: AuthSession }>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  setAuthToken(data.token);
  saveSession(data.session);
  return data.session;
}

export async function fetchCurrentSession(): Promise<AuthSession | null> {
  try {
    const data = await apiRequest<{ token?: string; session: AuthSession }>(
      '/api/auth/me'
    );
    if (data.token) {
      setAuthToken(data.token);
    }
    saveSession(data.session);
    return data.session;
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      clearSession();
      return null;
    }
    throw err;
  }
}

export async function logoutSession(): Promise<void> {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' });
  } catch {
    // Clear local session regardless of network errors
  } finally {
    clearSession();
  }
}

export async function fetchRegisteredUsers(
  firebaseIdToken: string
): Promise<UserAccount[]> {
  const data = await apiRequest<{ users: UserAccount[] }>(
    '/api/admin/users',
    {},
    firebaseIdToken
  );
  return data.users;
}

export async function updateRegisteredUser(
  firebaseIdToken: string,
  userId: number,
  payload: { name: string; email: string; phone: string }
): Promise<UserAccount> {
  const data = await apiRequest<{ user: UserAccount }>(
    `/api/admin/users/${userId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    firebaseIdToken
  );
  return data.user;
}

export async function deleteRegisteredUser(
  firebaseIdToken: string,
  userId: number
): Promise<void> {
  await apiRequest(
    `/api/admin/users/${userId}`,
    {
      method: 'DELETE',
    },
    firebaseIdToken
  );
}

export async function sendChatMessage(payload: {
  roleId: ChatRoleId;
  history: { role: 'user' | 'model'; text: string }[];
  message: string;
}): Promise<{ reply: string; model: string; roleId: ChatRoleId }> {
  return apiRequest<{ reply: string; model: string; roleId: ChatRoleId }>(
    '/api/chat',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

