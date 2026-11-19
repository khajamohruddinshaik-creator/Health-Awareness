import type { AuthSession, ContactInquiry } from '../types/health';

const SESSION_KEY = 'loggedInUser';
const TOKEN_KEY = 'hhAuthToken';
const INQUIRIES_KEY = 'healthInquiries';

export function getAuthToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function getSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export function getChecklistProgress(email: string): string[] {
  try {
    const raw = localStorage.getItem(`healthChecklist_${email.toLowerCase()}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveChecklistProgress(email: string, checkedIds: string[]): void {
  localStorage.setItem(
    `healthChecklist_${email.toLowerCase()}`,
    JSON.stringify(checkedIds)
  );
}

export function getHydrationGlasses(email: string): number {
  try {
    const raw = localStorage.getItem(`healthHydration_${email.toLowerCase()}`);
    const val = Number(raw);
    return Number.isFinite(val) && val >= 0 && val <= 8 ? val : 0;
  } catch {
    return 0;
  }
}

export function saveHydrationGlasses(email: string, count: number): void {
  localStorage.setItem(`healthHydration_${email.toLowerCase()}`, String(count));
}

export function getLastQuizScore(email: string): number | null {
  try {
    const raw = localStorage.getItem(`healthQuizScore_${email.toLowerCase()}`);
    if (raw === null) return null;
    const val = Number(raw);
    return Number.isFinite(val) ? val : null;
  } catch {
    return null;
  }
}

export function saveLastQuizScore(email: string, score: number): void {
  localStorage.setItem(`healthQuizScore_${email.toLowerCase()}`, String(score));
}

export function saveContactInquiry(inquiry: ContactInquiry): void {
  try {
    const raw = localStorage.getItem(INQUIRIES_KEY);
    const list: ContactInquiry[] = raw ? JSON.parse(raw) : [];
    list.unshift(inquiry);
    localStorage.setItem(INQUIRIES_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage quota issues
  }
}

export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getChecklistReminderEnabled(email: string): boolean {
  try {
    const raw = localStorage.getItem(
      `healthChecklistReminderEnabled_${email.toLowerCase()}`
    );
    if (raw === null) return true;
    return raw === 'true';
  } catch {
    return true;
  }
}

export function saveChecklistReminderEnabled(
  email: string,
  enabled: boolean
): void {
  try {
    localStorage.setItem(
      `healthChecklistReminderEnabled_${email.toLowerCase()}`,
      String(enabled)
    );
  } catch {
    // Ignore storage quota issues
  }
}

export function getLastChecklistReminderDate(email: string): string | null {
  try {
    return localStorage.getItem(
      `healthChecklistReminderSentDate_${email.toLowerCase()}`
    );
  } catch {
    return null;
  }
}

export function saveLastChecklistReminderDate(
  email: string,
  dateKey: string
): void {
  try {
    localStorage.setItem(
      `healthChecklistReminderSentDate_${email.toLowerCase()}`,
      dateKey
    );
  } catch {
    // Ignore storage quota issues
  }
}

