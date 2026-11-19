import { useEffect, useState, type FormEvent } from 'react';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { HERO_IMAGE } from '../data/healthContent';
import { auth, googleProvider, verifyFirebaseAdminAccess } from '../firebase';
import { ApiError, loginUser, registerUser } from '../services/api';
import type { AuthSession, AuthTab } from '../types/health';
import { ResilientImage } from './ResilientImage';

interface AuthPortalProps {
  initialTab?: AuthTab;
  initialNotice?: string | null;
  onUserLogin: (session: AuthSession) => void;
  onAdminLogin: (session: AuthSession) => void;
}

interface FeedbackState {
  type: 'error' | 'success';
  text: string;
}

function mapFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Invalid administrator email or password.';
    case 'auth/too-many-requests':
      return 'Too many failed sign-in attempts. Please wait a few minutes and try again.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in Firebase Console yet. Use Google Sign-In above, or enable Email/Password under Authentication → Sign-in method.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before completing authentication.';
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by your browser. Please allow popups for this site.';
    default:
      return error instanceof Error
        ? error.message
        : 'Unable to authenticate with Firebase.';
  }
}

export function AuthPortal({
  initialTab = 'login',
  initialNotice = null,
  onUserLogin,
  onAdminLogin,
}: AuthPortalProps) {
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);
  const [feedback, setFeedback] = useState<FeedbackState | null>(
    initialNotice ? { type: 'error', text: initialNotice } : null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // User login form
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);

  // Register form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegPw, setShowRegPw] = useState(false);

  // Firebase Admin login form
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPw, setShowAdminPw] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (initialNotice) {
      setFeedback({ type: 'error', text: initialNotice });
    }
  }, [initialNotice]);

  const switchTab = (tab: AuthTab) => {
    setActiveTab(tab);
    setFeedback(null);
  };

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsSubmitting(true);

    try {
      const session = await loginUser({
        identifier: loginId.trim(),
        password: loginPassword,
      });
      setLoginId('');
      setLoginPassword('');
      onUserLogin(session);
    } catch (err) {
      setFeedback({
        type: 'error',
        text:
          err instanceof ApiError
            ? err.message
            : 'Unable to sign in right now. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const name = regName.trim();
    const email = regEmail.trim().toLowerCase();
    const phone = regPhone.trim();

    if (!name) {
      setFeedback({ type: 'error', text: 'Please enter your full name.' });
      return;
    }

    if (!/^[0-9]{10}$/.test(phone)) {
      setFeedback({
        type: 'error',
        text: 'Enter a valid 10-digit phone number.',
      });
      return;
    }

    if (regPassword.length < 8) {
      setFeedback({
        type: 'error',
        text: 'Password must have at least 8 characters.',
      });
      return;
    }

    if (regPassword !== confirmPassword) {
      setFeedback({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await registerUser({
        name,
        email,
        phone,
        password: regPassword,
      });

      setRegName('');
      setRegEmail('');
      setRegPhone('');
      setRegPassword('');
      setConfirmPassword('');
      setFeedback({
        type: 'success',
        text: result.message || 'Registration successful! Please login.',
      });
      setActiveTab('login');
    } catch (err) {
      setFeedback({
        type: 'error',
        text:
          err instanceof ApiError
            ? err.message
            : 'Unable to complete registration. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAdminLogin = async () => {
    setFeedback(null);
    setIsSubmitting(true);

    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const isAdmin = await verifyFirebaseAdminAccess(credential.user);
      if (!isAdmin) {
        await signOut(auth);
        setFeedback({
          type: 'error',
          text: 'Access denied: This Google account does not have administrator privileges.',
        });
        return;
      }

      onAdminLogin({
        name: credential.user.displayName || 'Administrator',
        email: credential.user.email || '',
        role: 'admin',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: mapFirebaseAuthError(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailAdminSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsSubmitting(true);

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        adminEmail.trim(),
        adminPassword
      );
      const isAdmin = await verifyFirebaseAdminAccess(credential.user);
      if (!isAdmin) {
        await signOut(auth);
        setFeedback({
          type: 'error',
          text: 'Access denied: This account does not have administrator privileges.',
        });
        return;
      }

      setAdminEmail('');
      setAdminPassword('');
      onAdminLogin({
        name: credential.user.displayName || 'Administrator',
        email: credential.user.email || '',
        role: 'admin',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: mapFirebaseAuthError(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F9F7] flex flex-col">
      <header className="border-b border-[#DCE6E0] bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <span className="text-lg font-bold tracking-tight text-[#14241B] whitespace-nowrap shrink-0">
            Health &amp; Hygiene Awareness
          </span>
          <span className="text-sm text-[#495D52] whitespace-nowrap hidden sm:inline">
            Healthy Habits · Healthy Life
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 lg:py-12 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          {/* Left Editorial Showcase */}
          <div className="lg:col-span-7 flex flex-col justify-between bg-white border border-[#DCE6E0] rounded-2xl overflow-hidden">
            <div className="aspect-video w-full overflow-hidden bg-[#EAF2ED]">
              <ResilientImage
                src={HERO_IMAGE}
                alt="Sunlit modern vanity with ceramic soap dispenser, clean cotton towels, water carafe, and eucalyptus leaves"
                className="w-full h-full object-cover"
                fallbackTitle="Health & Hygiene Wellness"
              />
            </div>

            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between gap-6">
              <div>
                <p className="text-xs font-medium text-[#146C43] mb-2">
                  Personal Cleanliness · Nutrition · Disease Prevention
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#14241B] text-balance mb-3">
                  Good health starts with everyday hygiene habits.
                </h1>
                <p className="text-sm sm:text-base text-[#495D52] leading-relaxed max-w-2xl">
                  Sign in or create an account to explore the handwashing guide,
                  healthy nutrition essentials, daily hygiene checklist, and
                  interactive knowledge quiz.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5 border-t border-[#E6EFEA]">
                <div>
                  <p className="text-sm font-semibold text-[#14241B]">01. Daily Checklist</p>
                  <p className="text-xs text-[#495D52] mt-1">
                    Track 8 essential hygiene habits every day.
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#14241B]">02. Handwashing</p>
                  <p className="text-xs text-[#495D52] mt-1">
                    Interactive 6-step guide with 20s scrub timer.
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#14241B]">03. Knowledge Quiz</p>
                  <p className="text-xs text-[#495D52] mt-1">
                    Test hygiene and sanitation awareness.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Authentication Panel */}
          <div className="lg:col-span-5 bg-white border border-[#DCE6E0] rounded-2xl p-6 sm:p-8 flex flex-col justify-center">
            {/* Segmented Control */}
            <div
              role="tablist"
              aria-label="Authentication mode"
              className="grid grid-cols-3 gap-1 p-1 bg-[#F1F6F3] rounded-xl mb-6"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'login'}
                onClick={() => switchTab('login')}
                className={`py-2 px-3 min-h-10 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'login'
                    ? 'bg-white text-[#14241B] shadow-xs'
                    : 'text-[#495D52] hover:text-[#14241B]'
                }`}
              >
                User Login
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'register'}
                onClick={() => switchTab('register')}
                className={`py-2 px-3 min-h-10 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'register'
                    ? 'bg-white text-[#14241B] shadow-xs'
                    : 'text-[#495D52] hover:text-[#14241B]'
                }`}
              >
                Register
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'admin'}
                onClick={() => switchTab('admin')}
                className={`py-2 px-3 min-h-10 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-white text-[#14241B] shadow-xs'
                    : 'text-[#495D52] hover:text-[#14241B]'
                }`}
              >
                Admin
              </button>
            </div>

            {feedback && (
              <div
                role="alert"
                className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-sm mb-5 ${
                  feedback.type === 'error'
                    ? 'bg-[#FDF3F2] border-[#F2CFCB] text-[#9E2A22]'
                    : 'bg-[#EEF7F2] border-[#C4E2D0] text-[#0F5333]'
                }`}
              >
                {feedback.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            {activeTab === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-[#14241B]">User Login</h2>
                  <p className="text-sm text-[#495D52] mt-1">
                    Sign in using your registered email or 10-digit mobile number.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="loginId"
                    className="block text-sm font-medium text-[#14241B] mb-1.5"
                  >
                    Email Address or Phone Number
                  </label>
                  <input
                    id="loginId"
                    type="text"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="Enter email or phone number"
                    required
                    className="w-full px-3.5 py-2.5 min-h-11 rounded-lg border border-[#CFDCD4] bg-white text-sm text-[#14241B] placeholder:text-[#7B8E83] focus:border-[#146C43]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="loginPassword"
                    className="block text-sm font-medium text-[#14241B] mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="loginPassword"
                      type={showLoginPw ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter password"
                      required
                      className="w-full px-3.5 py-2.5 pr-11 min-h-11 rounded-lg border border-[#CFDCD4] bg-white text-sm text-[#14241B] placeholder:text-[#7B8E83] focus:border-[#146C43]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPw((v) => !v)}
                      aria-label={showLoginPw ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#5B7064] hover:text-[#14241B] cursor-pointer"
                    >
                      {showLoginPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-5 min-h-11 text-sm font-semibold text-white bg-[#146C43] rounded-lg hover:bg-[#0F5333] disabled:opacity-60 transition-colors cursor-pointer"
                >
                  <Lock className="w-4 h-4" aria-hidden="true" />
                  <span>{isSubmitting ? 'Signing in...' : 'Login'}</span>
                </button>

                <div className="pt-3 border-t border-[#E6EFEA] flex flex-wrap items-center justify-between gap-2 text-sm text-[#495D52]">
                  <span>
                    New user?{' '}
                    <button
                      type="button"
                      onClick={() => switchTab('register')}
                      className="font-semibold text-[#146C43] hover:underline cursor-pointer"
                    >
                      Register here
                    </button>
                  </span>
                  <button
                    type="button"
                    onClick={() => switchTab('admin')}
                    className="font-medium text-[#495D52] hover:text-[#14241B] hover:underline cursor-pointer"
                  >
                    Administrator Login
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div>
                  <h2 className="text-xl font-bold text-[#14241B]">Create Account</h2>
                  <p className="text-sm text-[#495D52] mt-1">
                    Register to save your daily hygiene progress and quiz score.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="regName"
                    className="block text-sm font-medium text-[#14241B] mb-1"
                  >
                    Full Name
                  </label>
                  <input
                    id="regName"
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Your full name"
                    required
                    className="w-full px-3.5 py-2.5 min-h-11 rounded-lg border border-[#CFDCD4] bg-white text-sm text-[#14241B] placeholder:text-[#7B8E83]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="regEmail"
                      className="block text-sm font-medium text-[#14241B] mb-1"
                    >
                      Email Address
                    </label>
                    <input
                      id="regEmail"
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="Your email"
                      required
                      className="w-full px-3.5 py-2.5 min-h-11 rounded-lg border border-[#CFDCD4] bg-white text-sm text-[#14241B] placeholder:text-[#7B8E83]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="regPhone"
                      className="block text-sm font-medium text-[#14241B] mb-1"
                    >
                      Phone Number
                    </label>
                    <input
                      id="regPhone"
                      type="tel"
                      maxLength={10}
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="10-digit mobile number"
                      required
                      className="w-full px-3.5 py-2.5 min-h-11 rounded-lg border border-[#CFDCD4] bg-white text-sm font-mono tabular-nums text-[#14241B] placeholder:font-sans placeholder:text-[#7B8E83]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="regPassword"
                    className="block text-sm font-medium text-[#14241B] mb-1"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="regPassword"
                      type={showRegPw ? 'text' : 'password'}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      required
                      className="w-full px-3.5 py-2.5 pr-11 min-h-11 rounded-lg border border-[#CFDCD4] bg-white text-sm text-[#14241B] placeholder:text-[#7B8E83]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPw((v) => !v)}
                      aria-label={showRegPw ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#5B7064] hover:text-[#14241B] cursor-pointer"
                    >
                      {showRegPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-[#14241B] mb-1"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type={showRegPw ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    required
                    className="w-full px-3.5 py-2.5 min-h-11 rounded-lg border border-[#CFDCD4] bg-white text-sm text-[#14241B] placeholder:text-[#7B8E83]"
                  />
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-5 min-h-11 text-sm font-semibold text-white bg-[#146C43] rounded-lg hover:bg-[#0F5333] disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" aria-hidden="true" />
                    <span>{isSubmitting ? 'Registering...' : 'Register'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => switchTab('login')}
                    className="py-2.5 px-4 min-h-11 text-sm font-medium text-[#374B40] bg-[#EEF3F0] rounded-lg hover:bg-[#E2EBE5] transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Back to Login
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'admin' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-[#14241B]">
                    Administrator Login
                  </h2>
                  <p className="text-sm text-[#495D52] mt-1">
                    Authenticate with Firebase to manage registered users in
                    Firestore.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleGoogleAdminLogin()}
                  className="w-full inline-flex items-center justify-center gap-2.5 py-2.5 px-5 min-h-11 text-sm font-semibold text-white bg-[#146C43] rounded-lg hover:bg-[#0F5333] disabled:opacity-60 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {isSubmitting
                      ? 'Authenticating...'
                      : 'Sign in with Google (Firebase Auth)'}
                  </span>
                </button>

                <div className="relative py-1 flex items-center">
                  <div className="flex-1 border-t border-[#E6EFEA]" />
                  <span className="px-3 text-xs text-[#6B7F73]">
                    or admin email &amp; password
                  </span>
                  <div className="flex-1 border-t border-[#E6EFEA]" />
                </div>

                <form onSubmit={handleEmailAdminSubmit} className="space-y-3.5">
                  <div>
                    <label
                      htmlFor="adminEmail"
                      className="block text-sm font-medium text-[#14241B] mb-1"
                    >
                      Administrator Email
                    </label>
                    <input
                      id="adminEmail"
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="Enter Firebase admin email"
                      autoComplete="username"
                      required
                      className="w-full px-3.5 py-2.5 min-h-11 rounded-lg border border-[#CFDCD4] bg-white text-sm text-[#14241B] placeholder:text-[#7B8E83]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="adminPassword"
                      className="block text-sm font-medium text-[#14241B] mb-1"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="adminPassword"
                        type={showAdminPw ? 'text' : 'password'}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Enter administrator password"
                        autoComplete="current-password"
                        required
                        className="w-full px-3.5 py-2.5 pr-11 min-h-11 rounded-lg border border-[#CFDCD4] bg-white text-sm text-[#14241B] placeholder:text-[#7B8E83]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPw((v) => !v)}
                        aria-label={showAdminPw ? 'Hide password' : 'Show password'}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#5B7064] hover:text-[#14241B] cursor-pointer"
                      >
                        {showAdminPw ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-5 min-h-11 text-sm font-semibold text-[#14241B] bg-[#EEF3F0] border border-[#CFDCD4] rounded-lg hover:bg-[#E2EBE5] disabled:opacity-60 transition-colors cursor-pointer"
                    >
                      <Lock className="w-4 h-4" aria-hidden="true" />
                      <span>Sign in with Email</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => switchTab('login')}
                      className="py-2.5 px-4 min-h-11 text-sm font-medium text-[#374B40] bg-white border border-[#DCE6E0] rounded-lg hover:bg-[#F3F7F5] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Back
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-[#DCE6E0] bg-white py-5 text-center text-xs text-[#495D52]">
        <p>© 2026 Health &amp; Hygiene Awareness Project · Stay Healthy | Stay Clean | Stay Safe</p>
      </footer>
    </div>
  );
}
