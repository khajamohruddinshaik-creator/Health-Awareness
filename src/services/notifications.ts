export type BrowserNotificationPermission = NotificationPermission | 'unsupported';

export const CHECKLIST_REMINDER_HOUR = 20; // 8:00 PM local time
export const CHECKLIST_REMINDER_MINUTE = 0;

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return window.Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  try {
    return await window.Notification.requestPermission();
  } catch {
    return window.Notification.permission;
  }
}

export function isPastEightPm(now: Date = new Date()): boolean {
  const hour = now.getHours();
  const minute = now.getMinutes();
  return (
    hour > CHECKLIST_REMINDER_HOUR ||
    (hour === CHECKLIST_REMINDER_HOUR && minute >= CHECKLIST_REMINDER_MINUTE)
  );
}

export function getMsUntilEightPm(now: Date = new Date()): number {
  const target = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    CHECKLIST_REMINDER_HOUR,
    CHECKLIST_REMINDER_MINUTE,
    0,
    0
  );
  return target.getTime() - now.getTime();
}

export interface ChecklistNotificationOptions {
  remainingCount: number;
  totalCount: number;
  isTest?: boolean;
  onOpenChecklist?: () => void;
}

export function showChecklistBrowserNotification({
  remainingCount,
  totalCount,
  isTest = false,
  onOpenChecklist,
}: ChecklistNotificationOptions): boolean {
  if (getBrowserNotificationPermission() !== 'granted') {
    return false;
  }

  const title = isTest
    ? 'Test: 8:00 PM Hygiene Checklist Reminder'
    : 'Daily Hygiene Checklist Reminder';

  const body =
    remainingCount > 0
      ? `It's 8:00 PM — you still have ${remainingCount} of ${totalCount} daily hygiene habits left to complete today.`
      : 'All 8 daily hygiene habits are already completed today. Great job!';

  try {
    const notification = new window.Notification(title, {
      body,
      tag: isTest ? 'daily-checklist-8pm-test' : 'daily-checklist-8pm',
      requireInteraction: false,
    });

    notification.onclick = () => {
      window.focus();
      onOpenChecklist?.();
      notification.close();
    };

    return true;
  } catch {
    return false;
  }
}
