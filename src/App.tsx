import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { AlertCircle, Bell, X } from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthPortal } from './components/AuthPortal';
import { AwarenessSection } from './components/AwarenessSection';
import { ChatSection } from './components/ChatSection';
import { ChecklistSection } from './components/ChecklistSection';
import { ContactSection } from './components/ContactSection';
import { HealthyFoodSection } from './components/HealthyFoodSection';
import { HomeSection } from './components/HomeSection';
import { QuizSection } from './components/QuizSection';
import { TopBar } from './components/TopBar';
import { CHECKLIST_HABITS } from './data/healthContent';
import { auth, verifyFirebaseAdminAccess } from './firebase';
import { fetchCurrentSession, logoutSession } from './services/api';
import {
  getBrowserNotificationPermission,
  getMsUntilEightPm,
  isPastEightPm,
  requestBrowserNotificationPermission,
  showChecklistBrowserNotification,
  type BrowserNotificationPermission,
} from './services/notifications';
import {
  clearSession,
  getChecklistProgress,
  getChecklistReminderEnabled,
  getHydrationGlasses,
  getLastChecklistReminderDate,
  getLastQuizScore,
  getLocalDateKey,
  saveChecklistProgress,
  saveChecklistReminderEnabled,
  saveHydrationGlasses,
  saveLastChecklistReminderDate,
  saveLastQuizScore,
} from './services/storage';
import type {
  AuthSession,
  AuthTab,
  PortalSection,
  PortalView,
} from './types/health';

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith('/admin');
}

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [verifyingSession, setVerifyingSession] = useState(true);
  const [view, setView] = useState<PortalView>('auth');
  const [authTab, setAuthTab] = useState<AuthTab>(() =>
    isAdminPath(window.location.pathname) ? 'admin' : 'login'
  );
  const [accessNotice, setAccessNotice] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<PortalSection>('home');

  const [checkedHabits, setCheckedHabits] = useState<string[]>([]);
  const [hydrationGlasses, setHydrationGlasses] = useState<number>(0);
  const [lastQuizScore, setLastQuizScore] = useState<number | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(true);
  const [notificationPermission, setNotificationPermission] =
    useState<BrowserNotificationPermission>(() =>
      getBrowserNotificationPermission()
    );
  const [checklistReminderBanner, setChecklistReminderBanner] = useState<{
    remainingCount: number;
    totalCount: number;
  } | null>(null);

  const loadUserProgress = useCallback((email: string) => {
    setCheckedHabits(getChecklistProgress(email));
    setHydrationGlasses(getHydrationGlasses(email));
    setLastQuizScore(getLastQuizScore(email));
    setReminderEnabled(getChecklistReminderEnabled(email));
    setNotificationPermission(getBrowserNotificationPermission());
    setChecklistReminderBanner(null);
  }, []);

  const syncRouteForSession = useCallback(
    (verified: AuthSession | null) => {
      const wantsAdmin = isAdminPath(window.location.pathname);

      if (!verified) {
        setSession(null);
        setView('auth');
        if (wantsAdmin) {
          setAuthTab('admin');
        }
        return;
      }

      setSession(verified);

      if (verified.role === 'admin') {
        setView('admin');
        if (!wantsAdmin) {
          window.history.replaceState(null, '', '/admin');
        }
        return;
      }

      // Normal users cannot access the Admin Dashboard
      loadUserProgress(verified.email);
      setView('portal');
      if (wantsAdmin) {
        setAccessNotice(
          'Access denied: Normal user accounts cannot access the Admin Dashboard.'
        );
        window.history.replaceState(null, '', '/');
      }
    },
    [loadUserProgress]
  );

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const isAdmin = await verifyFirebaseAdminAccess(firebaseUser);
          if (!active) return;

          if (isAdmin) {
            syncRouteForSession({
              name: firebaseUser.displayName || 'Administrator',
              email: firebaseUser.email || '',
              role: 'admin',
            });
            setVerifyingSession(false);
            return;
          }
        }

        // Fall back to verifying normal user backend session
        const userSession = await fetchCurrentSession();
        if (active) {
          syncRouteForSession(userSession);
        }
      } catch {
        if (active) {
          syncRouteForSession(null);
        }
      } finally {
        if (active) {
          setVerifyingSession(false);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [syncRouteForSession]);

  useEffect(() => {
    const handlePopState = () => {
      syncRouteForSession(session);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [session, syncRouteForSession]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeSection, view]);

  const handleUserLogin = (newSession: AuthSession) => {
    setSession(newSession);
    setAccessNotice(null);
    loadUserProgress(newSession.email);
    setActiveSection('home');
    setView('portal');
    if (window.location.pathname !== '/') {
      window.history.pushState(null, '', '/');
    }
  };

  const handleAdminLogin = (adminSession: AuthSession) => {
    setSession(adminSession);
    setAccessNotice(null);
    setView('admin');
    if (window.location.pathname !== '/admin') {
      window.history.pushState(null, '', '/admin');
    }
  };

  const handleLogout = async () => {
    if (auth.currentUser) {
      await signOut(auth);
    }
    await logoutSession();
    setSession(null);
    setAccessNotice(null);
    setChecklistReminderBanner(null);
    setActiveSection('home');
    setAuthTab('login');
    setView('auth');
    if (window.location.pathname !== '/') {
      window.history.pushState(null, '', '/');
    }
  };

  const handleUnauthorizedAdmin = useCallback((message: string) => {
    void signOut(auth);
    clearSession();
    setSession(null);
    setAuthTab('admin');
    setAccessNotice(message);
    setView('auth');
    if (window.location.pathname !== '/') {
      window.history.replaceState(null, '', '/');
    }
  }, []);

  const handleToggleHabit = (habitId: string) => {
    setCheckedHabits((prev) => {
      const updated = prev.includes(habitId)
        ? prev.filter((id) => id !== habitId)
        : [...prev, habitId];
      if (session?.email) {
        saveChecklistProgress(session.email, updated);
      }
      return updated;
    });
  };

  const handleResetChecklist = () => {
    setCheckedHabits([]);
    if (session?.email) {
      saveChecklistProgress(session.email, []);
    }
  };

  const handleUpdateHydration = (count: number) => {
    setHydrationGlasses(count);
    if (session?.email) {
      saveHydrationGlasses(session.email, count);
    }
  };

  const handleScoreSaved = (score: number) => {
    setLastQuizScore(score);
    if (session?.email) {
      saveLastQuizScore(session.email, score);
    }
  };

  // Clear in-app 8:00 PM reminder banner automatically once all 8 habits are completed
  useEffect(() => {
    if (checkedHabits.length >= CHECKLIST_HABITS.length) {
      setChecklistReminderBanner(null);
    }
  }, [checkedHabits.length]);

  // Monitor 8:00 PM local time and fire browser + in-app reminder if checklist is incomplete
  useEffect(() => {
    if (
      view !== 'portal' ||
      !session?.email ||
      session.role !== 'user' ||
      !reminderEnabled
    ) {
      return;
    }

    const userEmail = session.email;
    const totalCount = CHECKLIST_HABITS.length;

    const evaluateReminder = () => {
      const remainingCount = totalCount - checkedHabits.length;
      if (remainingCount <= 0) {
        setChecklistReminderBanner(null);
        return;
      }

      const now = new Date();
      if (!isPastEightPm(now)) {
        return;
      }

      const todayKey = getLocalDateKey(now);
      if (getLastChecklistReminderDate(userEmail) === todayKey) {
        return;
      }

      saveLastChecklistReminderDate(userEmail, todayKey);
      setChecklistReminderBanner({ remainingCount, totalCount });
      setNotificationPermission(getBrowserNotificationPermission());

      showChecklistBrowserNotification({
        remainingCount,
        totalCount,
        onOpenChecklist: () => setActiveSection('checklist'),
      });
    };

    evaluateReminder();

    const msUntilEightPm = getMsUntilEightPm();
    let timeoutId: number | undefined;
    if (msUntilEightPm > 0) {
      timeoutId = window.setTimeout(evaluateReminder, msUntilEightPm + 250);
    }

    const intervalId = window.setInterval(evaluateReminder, 30_000);

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      window.clearInterval(intervalId);
    };
  }, [view, session, reminderEnabled, checkedHabits.length]);

  const handleEnableBrowserNotifications = useCallback(async () => {
    const permission = await requestBrowserNotificationPermission();
    setNotificationPermission(permission);
    if (session?.email && permission === 'granted') {
      setReminderEnabled(true);
      saveChecklistReminderEnabled(session.email, true);
    }
    return permission;
  }, [session?.email]);

  const handleToggleReminderEnabled = useCallback(async () => {
    if (!session?.email) return;
    const next = !reminderEnabled;
    setReminderEnabled(next);
    saveChecklistReminderEnabled(session.email, next);

    if (!next) {
      setChecklistReminderBanner(null);
      return;
    }

    if (getBrowserNotificationPermission() === 'default') {
      const permission = await requestBrowserNotificationPermission();
      setNotificationPermission(permission);
    }
  }, [reminderEnabled, session?.email]);

  const handleSendTestNotification = useCallback(async () => {
    let permission = getBrowserNotificationPermission();
    if (permission === 'default') {
      permission = await requestBrowserNotificationPermission();
      setNotificationPermission(permission);
    }

    const totalCount = CHECKLIST_HABITS.length;
    const remainingCount = Math.max(0, totalCount - checkedHabits.length);

    if (permission === 'granted') {
      const sent = showChecklistBrowserNotification({
        remainingCount,
        totalCount,
        isTest: true,
        onOpenChecklist: () => setActiveSection('checklist'),
      });
      if (sent) {
        return {
          sentBrowser: true,
          message:
            remainingCount > 0
              ? `Test notification sent (${remainingCount} of ${totalCount} habits remaining).`
              : 'Test notification sent (all 8 habits are already completed today).',
        };
      }
    }

    if (remainingCount > 0) {
      setChecklistReminderBanner({ remainingCount, totalCount });
    }

    return {
      sentBrowser: false,
      message:
        permission === 'denied'
          ? 'Browser notifications are blocked in site settings; previewed the in-app reminder banner at the top instead.'
          : 'Browser notification permission is not available here; previewed the in-app reminder banner at the top instead.',
    };
  }, [checkedHabits.length]);

  if (verifyingSession) {
    return (
      <div className="min-h-screen bg-[#F6F9F7] flex items-center justify-center p-6">
        <p className="text-sm font-medium text-[#495D52]">
          Verifying authentication session...
        </p>
      </div>
    );
  }

  if (view === 'auth') {
    return (
      <AuthPortal
        initialTab={authTab}
        initialNotice={accessNotice}
        onUserLogin={handleUserLogin}
        onAdminLogin={handleAdminLogin}
      />
    );
  }

  if (view === 'admin' && session?.role === 'admin') {
    return (
      <AdminDashboard
        adminEmail={session.email}
        onLogout={() => void handleLogout()}
        onUnauthorized={handleUnauthorizedAdmin}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F9F7] flex flex-col">
      <TopBar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onLogout={() => void handleLogout()}
      />

      {accessNotice && (
        <div
          role="alert"
          className="bg-[#FDF3F2] border-b border-[#F2CFCB] text-[#9E2A22] px-4 py-2.5 text-sm"
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{accessNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setAccessNotice(null)}
              aria-label="Dismiss access notice"
              className="p-1 rounded hover:bg-[#FBE6E4] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {checklistReminderBanner && (
        <div
          role="status"
          className="bg-[#FFF9EB] border-b border-[#EED9A4] text-[#5F4308] px-4 py-3 text-sm"
        >
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Bell className="w-4 h-4 shrink-0 text-[#9A6700]" aria-hidden="true" />
              <span>
                8:00 PM Hygiene Reminder: You still have{' '}
                <span className="font-semibold tabular-nums">
                  {checklistReminderBanner.remainingCount} of{' '}
                  {checklistReminderBanner.totalCount}
                </span>{' '}
                daily checklist habits left to complete today.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {activeSection !== 'checklist' && (
                <button
                  type="button"
                  onClick={() => setActiveSection('checklist')}
                  className="px-3 py-1.5 min-h-9 text-xs font-semibold text-white bg-[#146C43] rounded-lg hover:bg-[#0F5333] transition-colors whitespace-nowrap cursor-pointer"
                >
                  Open Checklist
                </button>
              )}
              <button
                type="button"
                onClick={() => setChecklistReminderBanner(null)}
                aria-label="Dismiss daily checklist reminder"
                className="p-1.5 rounded hover:bg-[#F7EBC7] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {activeSection === 'home' && (
          <HomeSection
            userName={session?.name ?? 'Guest'}
            checklistCount={checkedHabits.length}
            totalChecklist={CHECKLIST_HABITS.length}
            lastQuizScore={lastQuizScore}
            onNavigate={setActiveSection}
          />
        )}

        {activeSection === 'awareness' && <AwarenessSection />}

        {activeSection === 'food' && (
          <HealthyFoodSection
            hydrationGlasses={hydrationGlasses}
            onUpdateHydration={handleUpdateHydration}
          />
        )}

        {activeSection === 'checklist' && (
          <ChecklistSection
            checkedIds={checkedHabits}
            reminderEnabled={reminderEnabled}
            notificationPermission={notificationPermission}
            onToggleHabit={handleToggleHabit}
            onResetChecklist={handleResetChecklist}
            onEnableBrowserNotifications={handleEnableBrowserNotifications}
            onToggleReminderEnabled={handleToggleReminderEnabled}
            onSendTestNotification={handleSendTestNotification}
          />
        )}

        {activeSection === 'quiz' && (
          <QuizSection onScoreSaved={handleScoreSaved} />
        )}

        {activeSection === 'chat' && (
          <ChatSection userName={session?.name ?? 'Guest'} />
        )}

        {activeSection === 'contact' && (
          <ContactSection
            defaultName={session?.name ?? ''}
            defaultEmail={session?.email ?? ''}
          />
        )}
      </main>

      <footer className="border-t border-[#DCE6E0] bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#495D52]">
          <p>© 2026 Health &amp; Hygiene Awareness Project · Stay Healthy | Stay Clean | Stay Safe</p>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveSection('home')}
              className="hover:text-[#14241B] hover:underline cursor-pointer"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('awareness')}
              className="hover:text-[#14241B] hover:underline cursor-pointer"
            >
              Awareness
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('food')}
              className="hover:text-[#14241B] hover:underline cursor-pointer"
            >
              Healthy Food
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('checklist')}
              className="hover:text-[#14241B] hover:underline cursor-pointer"
            >
              Checklist
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('quiz')}
              className="hover:text-[#14241B] hover:underline cursor-pointer"
            >
              Quiz
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('chat')}
              className="hover:text-[#14241B] hover:underline cursor-pointer"
            >
              Hygiene Chat
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('contact')}
              className="hover:text-[#14241B] hover:underline cursor-pointer"
            >
              Contact
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
