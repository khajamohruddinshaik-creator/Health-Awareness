import { useState } from 'react';
import { Bell, BellOff, Check, CheckCircle2, RotateCcw } from 'lucide-react';
import { CHECKLIST_HABITS } from '../data/healthContent';
import type { BrowserNotificationPermission } from '../services/notifications';

interface ChecklistSectionProps {
  checkedIds: string[];
  reminderEnabled: boolean;
  notificationPermission: BrowserNotificationPermission;
  onToggleHabit: (id: string) => void;
  onResetChecklist: () => void;
  onEnableBrowserNotifications: () => Promise<BrowserNotificationPermission>;
  onToggleReminderEnabled: () => Promise<void>;
  onSendTestNotification: () => Promise<{ sentBrowser: boolean; message: string }>;
}

export function ChecklistSection({
  checkedIds,
  reminderEnabled,
  notificationPermission,
  onToggleHabit,
  onResetChecklist,
  onEnableBrowserNotifications,
  onToggleReminderEnabled,
  onSendTestNotification,
}: ChecklistSectionProps) {
  const [statusConfirmed, setStatusConfirmed] = useState(false);
  const [reminderFeedback, setReminderFeedback] = useState<string | null>(null);
  const [testingNotification, setTestingNotification] = useState(false);

  const count = checkedIds.length;
  const total = CHECKLIST_HABITS.length;
  const percentage = Math.round((count / total) * 100);

  const handleCheckProgress = () => {
    setStatusConfirmed(true);
  };

  const handleEnableClick = async () => {
    setReminderFeedback(null);
    const result = await onEnableBrowserNotifications();
    if (result === 'granted') {
      setReminderFeedback(
        'Browser notifications enabled. You will be alerted at 8:00 PM if habits remain incomplete.'
      );
    } else if (result === 'denied') {
      setReminderFeedback(
        'Browser notifications are blocked in site settings. In-app 8:00 PM reminders remain active.'
      );
    } else if (result === 'unsupported') {
      setReminderFeedback(
        'This browser does not support native notifications. In-app 8:00 PM reminders remain active.'
      );
    }
  };

  const handleToggleReminderClick = async () => {
    setReminderFeedback(null);
    await onToggleReminderEnabled();
  };

  const handleTestClick = async () => {
    setReminderFeedback(null);
    setTestingNotification(true);
    try {
      const result = await onSendTestNotification();
      setReminderFeedback(result.message);
    } finally {
      setTestingNotification(false);
    }
  };

  const permissionStatusLabel = !reminderEnabled
    ? 'Paused'
    : notificationPermission === 'granted'
      ? 'Browser alerts active for 8:00 PM'
      : notificationPermission === 'denied'
        ? 'Browser alerts blocked (in-app 8:00 PM banner active)'
        : notificationPermission === 'unsupported'
          ? 'Browser alerts unsupported (in-app 8:00 PM banner active)'
          : 'Permission needed for OS popups (in-app 8:00 PM banner active)';

  return (
    <div className="bg-white border border-[#DCE6E0] rounded-2xl p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#E6EFEA]">
        <div>
          <p className="text-xs font-medium text-[#146C43] mb-1">
            Personal Habit Tracker
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#14241B]">
            Daily Hygiene Checklist
          </h1>
          <p className="text-sm text-[#495D52] mt-1">
            Select the activities you have completed today.
          </p>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-xs text-[#5B7064]">Today&apos;s Completion</p>
          <p className="text-xl font-bold font-mono tabular-nums text-[#14241B]">
            {count} / {total} completed ({percentage}%)
          </p>
        </div>
      </div>

      <div className="w-full h-3 bg-[#EAF2ED] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#146C43] transition-all duration-200"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {CHECKLIST_HABITS.map((habit) => {
          const isChecked = checkedIds.includes(habit.id);
          return (
            <label
              key={habit.id}
              className={`flex items-center justify-between gap-4 p-4 min-h-14 rounded-xl border transition-colors cursor-pointer ${
                isChecked
                  ? 'bg-[#EEF7F2] border-[#9FD0B4]'
                  : 'bg-[#F9FCFA] border-[#DCE6E0] hover:bg-white'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {
                    setStatusConfirmed(false);
                    onToggleHabit(habit.id);
                  }}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                    isChecked
                      ? 'bg-[#146C43] border-[#146C43] text-white'
                      : 'bg-white border-[#B8C7BE]'
                  }`}
                >
                  {isChecked && <Check className="w-3.5 h-3.5" />}
                </span>
                <span className="text-sm font-medium text-[#14241B]">
                  {habit.label}
                </span>
              </div>
              <span className="text-xs text-[#5B7064] whitespace-nowrap shrink-0">
                {habit.category}
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#E6EFEA]">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleCheckProgress}
            className="inline-flex items-center gap-2 px-5 py-2.5 min-h-11 text-sm font-semibold text-white bg-[#146C43] rounded-lg hover:bg-[#0F5333] transition-colors whitespace-nowrap cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            <span>Check Progress</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusConfirmed(false);
              onResetChecklist();
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-11 text-sm font-medium text-[#374B40] bg-[#EEF3F0] rounded-lg hover:bg-[#E2EBE5] transition-colors whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span>Reset Checklist</span>
          </button>
        </div>

        {statusConfirmed && (
          <p className="text-sm font-medium text-[#0F5333]" role="status">
            {count === total
              ? 'All 8 daily hygiene habits completed today.'
              : `Progress saved: ${count} of ${total} habits completed (${percentage}%).`}
          </p>
        )}
      </div>

      {/* 8:00 PM Browser Reminder Controls */}
      <div className="pt-5 border-t border-[#E6EFEA] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[#14241B] flex items-center gap-2">
            {reminderEnabled ? (
              <Bell className="w-4 h-4 text-[#146C43]" aria-hidden="true" />
            ) : (
              <BellOff className="w-4 h-4 text-[#5B7064]" aria-hidden="true" />
            )}
            <span>8:00 PM Daily Checklist Reminder</span>
            <span aria-hidden="true" className="text-[#B8C7BE]">·</span>
            <span className="text-xs font-medium text-[#495D52]">
              {permissionStatusLabel}
            </span>
          </p>
          <p className="text-xs text-[#495D52]">
            Triggers a browser notification at 8:00 PM local time whenever any of your 8 daily habits remain incomplete.
          </p>
          {reminderFeedback && (
            <p className="text-xs font-medium text-[#146C43] pt-1" role="status">
              {reminderFeedback}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {notificationPermission === 'default' && (
            <button
              type="button"
              onClick={() => void handleEnableClick()}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-11 text-sm font-semibold text-white bg-[#146C43] rounded-lg hover:bg-[#0F5333] transition-colors whitespace-nowrap cursor-pointer"
            >
              <Bell className="w-4 h-4" aria-hidden="true" />
              <span>Enable Browser Alerts</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleToggleReminderClick()}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-11 text-sm font-medium text-[#14241B] bg-[#F2F7F4] border border-[#CFDCD4] rounded-lg hover:bg-[#E7F0EB] transition-colors whitespace-nowrap cursor-pointer"
          >
            <span>
              {reminderEnabled ? 'Pause 8:00 PM Reminder' : 'Resume 8:00 PM Reminder'}
            </span>
          </button>
          <button
            type="button"
            disabled={testingNotification}
            onClick={() => void handleTestClick()}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-11 text-sm font-medium text-[#374B40] bg-white border border-[#DCE6E0] rounded-lg hover:bg-[#F3F7F5] disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
          >
            <span>{testingNotification ? 'Sending...' : 'Test Notification'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

