import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { AlertCircle, MessageSquare, RotateCcw, Send } from 'lucide-react';
import { ApiError, sendChatMessage } from '../services/api';
import type { ChatMessage, ChatRoleId } from '../types/health';

interface ChatSectionProps {
  userName: string;
}

interface RoleMetadata {
  id: ChatRoleId;
  label: string;
  subtitle: string;
  modelLabel: string;
  starterPrompts: string[];
}

const CHAT_ROLE_CONFIGS: RoleMetadata[] = [
  {
    id: 'hygiene-coach',
    label: 'Hygiene Coach',
    subtitle:
      'Step-by-step advice on handwashing, oral care, personal cleanliness, and disease prevention.',
    modelLabel: 'General Coach · gemini-3.1-flash-lite',
    starterPrompts: [
      'When are the most important times to wash hands with soap?',
      'How can I build a consistent morning and evening hygiene routine?',
      'What are the best practices for keeping drinking water and utensils safe?',
    ],
  },
  {
    id: 'nutrition-guide',
    label: 'Nutrition Guide',
    subtitle:
      'Balanced meal planning, food hygiene, hydration habits, and everyday immune-supporting foods.',
    modelLabel: 'Nutrition Advisor · gemini-3.1-flash-lite',
    starterPrompts: [
      'How should I structure a balanced daily plate for steady energy?',
      'What are simple ways to hit 8 glasses of clean water every day?',
      'How should fresh fruits and leafy vegetables be washed before eating?',
    ],
  },
  {
    id: 'quick-helper',
    label: 'Quick Helper',
    subtitle:
      'Fast, concise answers and short checklists when you need immediate hygiene tips.',
    modelLabel: 'Fast Responses · gemini-3.1-flash-lite',
    starterPrompts: [
      'Give me a 4-bullet evening hygiene checklist before sleep.',
      'Quick rule for safe food storage in warm weather?',
      'Why is 20 seconds recommended for handwashing?',
    ],
  },
];

export function ChatSection({ userName }: ChatSectionProps) {
  const [selectedRole, setSelectedRole] = useState<ChatRoleId>('hygiene-coach');
  const [messagesByRole, setMessagesByRole] = useState<Record<ChatRoleId, ChatMessage[]>>({
    'hygiene-coach': [],
    'nutrition-guide': [],
    'quick-helper': [],
  });
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const activeConfig =
    CHAT_ROLE_CONFIGS.find((role) => role.id === selectedRole) ??
    CHAT_ROLE_CONFIGS[0];
  const messages = messagesByRole[selectedRole];

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, sending, selectedRole]);

  const submitMessage = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || sending) return;

    setError(null);
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    const currentHistory = messages.map((msg) => ({
      role: msg.role,
      text: msg.text,
    }));

    setMessagesByRole((prev) => ({
      ...prev,
      [selectedRole]: [...prev[selectedRole], userMessage],
    }));
    setInput('');
    setSending(true);

    try {
      const result = await sendChatMessage({
        roleId: selectedRole,
        history: currentHistory,
        message: trimmed,
      });

      const assistantMessage: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: result.reply,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        model: result.model,
      };

      setMessagesByRole((prev) => ({
        ...prev,
        [selectedRole]: [...prev[selectedRole], assistantMessage],
      }));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Unable to reach the assistant right now. Please try again.'
      );
    } finally {
      setSending(false);
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submitMessage(input);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submitMessage(input);
    }
  };

  const handleClearChat = () => {
    setError(null);
    setMessagesByRole((prev) => ({
      ...prev,
      [selectedRole]: [],
    }));
  };

  return (
    <div className="bg-white border border-[#DCE6E0] rounded-2xl p-6 sm:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-[#E6EFEA]">
        <div>
          <p className="text-xs font-medium text-[#146C43] mb-1">
            Interactive Guidance · {activeConfig.modelLabel}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#14241B]">
            Health &amp; Hygiene Assistant
          </h1>
          <p className="text-sm text-[#495D52] mt-1 max-w-2xl">
            {activeConfig.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div
            role="tablist"
            aria-label="Chatbot specialist role"
            className="flex flex-wrap items-center gap-1 p-1 bg-[#F1F6F3] rounded-xl"
          >
            {CHAT_ROLE_CONFIGS.map((role) => {
              const isActive = role.id === selectedRole;
              return (
                <button
                  key={role.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  disabled={sending}
                  onClick={() => {
                    setError(null);
                    setSelectedRole(role.id);
                  }}
                  className={`px-3.5 py-2 min-h-10 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
                    isActive
                      ? 'bg-white text-[#14241B] shadow-xs'
                      : 'text-[#495D52] hover:text-[#14241B]'
                  }`}
                >
                  {role.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleClearChat}
            disabled={messages.length === 0 || sending}
            className="inline-flex items-center gap-2 px-3.5 py-2 min-h-10 text-xs sm:text-sm font-medium text-[#374B40] bg-[#EEF3F0] rounded-lg hover:bg-[#E2EBE5] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>New Chat</span>
          </button>
        </div>
      </div>

      {/* Scrollable Conversation Thread */}
      <div
        role="log"
        aria-live="polite"
        aria-label="Conversation history"
        className="h-[420px] sm:h-[480px] overflow-y-auto rounded-xl border border-[#DCE6E0] bg-[#F9FCFA] p-4 sm:p-6 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-5">
            <div className="space-y-2">
              <div className="w-11 h-11 rounded-xl bg-[#EAF4EE] text-[#146C43] flex items-center justify-center mx-auto">
                <MessageSquare className="w-5 h-5" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-bold text-[#14241B]">
                Hi {userName}, ask the {activeConfig.label}
              </h2>
              <p className="text-sm text-[#495D52] leading-relaxed">
                Start a conversation below or choose a question to explore daily
                cleanliness, nutrition, hydration, and disease prevention.
              </p>
            </div>

            <div className="w-full space-y-2.5 text-left">
              {activeConfig.starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={sending}
                  onClick={() => void submitMessage(prompt)}
                  className="w-full text-left px-4 py-3 min-h-11 rounded-xl bg-white border border-[#DCE6E0] hover:border-[#146C43]/60 text-sm text-[#14241B] transition-colors cursor-pointer disabled:opacity-60"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 space-y-1.5 ${
                      isUser
                        ? 'bg-[#146C43] text-white'
                        : 'bg-white border border-[#DCE6E0] text-[#14241B]'
                    }`}
                  >
                    <div
                      className={`flex items-center gap-2 text-xs ${
                        isUser ? 'text-[#D4ECE0]' : 'text-[#5B7064]'
                      }`}
                    >
                      <span className="font-semibold">
                        {isUser ? userName : activeConfig.label}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{msg.timestamp}</span>
                    </div>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {msg.text}
                    </div>
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="flex justify-start">
                <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-white border border-[#DCE6E0] text-sm text-[#495D52]">
                  {activeConfig.label} is preparing a response...
                </div>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#FDF3F2] border border-[#F2CFCB] text-sm text-[#9E2A22]"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
          </>
        )}
        <div ref={threadEndRef} />
      </div>

      {/* Message Composer */}
      <form onSubmit={handleFormSubmit} className="space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="flex-1">
            <label htmlFor="chatMessageInput" className="sr-only">
              Ask a health or hygiene question
            </label>
            <textarea
              id="chatMessageInput"
              rows={2}
              maxLength={2000}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask the ${activeConfig.label} a question...`}
              disabled={sending}
              className="w-full px-4 py-3 rounded-xl border border-[#CFDCD4] bg-white text-sm text-[#14241B] placeholder:text-[#7B8E83] focus:border-[#146C43] resize-none disabled:opacity-60"
            />
          </div>

          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-12 text-sm font-semibold text-white bg-[#146C43] rounded-xl hover:bg-[#0F5333] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            <span>{sending ? 'Sending...' : 'Send'}</span>
          </button>
        </div>

        <p className="text-xs text-[#5B7064]">
          Educational hygiene &amp; wellness information only — consult a qualified healthcare professional for medical diagnosis or emergencies.
        </p>
      </form>
    </div>
  );
}
