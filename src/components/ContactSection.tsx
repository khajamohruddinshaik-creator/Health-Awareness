import { useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Mail, Send } from 'lucide-react';
import { saveContactInquiry } from '../services/storage';

interface ContactSectionProps {
  defaultName: string;
  defaultEmail: string;
}

export function ContactSection({
  defaultName,
  defaultEmail,
}: ContactSectionProps) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName || !trimmedEmail || !trimmedMessage) {
      setStatus({
        type: 'error',
        text: 'Please fill in your name, email address, and message.',
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setStatus({
        type: 'error',
        text: 'Please enter a valid email address.',
      });
      return;
    }

    saveContactInquiry({
      id: Date.now(),
      name: trimmedName,
      email: trimmedEmail,
      message: trimmedMessage,
      submittedAt: new Date().toISOString(),
    });

    setMessage('');
    setStatus({
      type: 'success',
      text: 'Thank you for your feedback! Your message has been recorded.',
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      <div className="lg:col-span-5 bg-white border border-[#DCE6E0] rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6">
        <div className="space-y-4">
          <p className="text-xs font-medium text-[#146C43]">Project Information</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#14241B]">
            Contact Us
          </h1>
          <p className="text-sm sm:text-base text-[#495D52] leading-relaxed">
            Health and Hygiene Awareness Mini Project
          </p>
          <p className="text-sm text-[#495D52] leading-relaxed">
            Purpose: Creating awareness about cleanliness, personal hygiene,
            safe drinking water, balanced nutrition, and healthy living.
          </p>
        </div>

        <div className="pt-5 border-t border-[#E6EFEA] space-y-2 text-sm text-[#374B40]">
          <div className="flex items-center gap-2 font-medium text-[#14241B]">
            <Mail className="w-4 h-4 text-[#146C43]" aria-hidden="true" />
            <span>Community Awareness Outreach</span>
          </div>
          <p className="text-xs text-[#495D52]">
            Thank you for visiting our website and practicing healthy habits.
          </p>
        </div>
      </div>

      <div className="lg:col-span-7 bg-white border border-[#DCE6E0] rounded-2xl p-6 sm:p-8">
        <h2 className="text-xl font-bold text-[#14241B]">Send Feedback</h2>
        <p className="text-sm text-[#495D52] mt-1 mb-5">
          Share suggestions or questions about hygiene and nutrition topics.
        </p>

        {status && (
          <div
            role="status"
            className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-sm mb-5 ${
              status.type === 'error'
                ? 'bg-[#FDF3F2] border-[#F2CFCB] text-[#9E2A22]'
                : 'bg-[#EEF7F2] border-[#C4E2D0] text-[#0F5333]'
            }`}
          >
            {status.type === 'error' ? (
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <span>{status.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="contactName"
                className="block text-sm font-medium text-[#14241B] mb-1.5"
              >
                Your Name
              </label>
              <input
                id="contactName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 min-h-11 rounded-lg border border-[#CFDCD4] bg-white text-sm text-[#14241B]"
              />
            </div>

            <div>
              <label
                htmlFor="contactEmail"
                className="block text-sm font-medium text-[#14241B] mb-1.5"
              >
                Email Address
              </label>
              <input
                id="contactEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 min-h-11 rounded-lg border border-[#CFDCD4] bg-white text-sm text-[#14241B]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="contactMessage"
              className="block text-sm font-medium text-[#14241B] mb-1.5"
            >
              Message
            </label>
            <textarea
              id="contactMessage"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your feedback or question..."
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#CFDCD4] bg-white text-sm text-[#14241B] placeholder:text-[#7B8E83]"
            />
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 min-h-11 text-sm font-semibold text-white bg-[#146C43] rounded-lg hover:bg-[#0F5333] transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            <span>Submit Message</span>
          </button>
        </form>
      </div>
    </div>
  );
}
