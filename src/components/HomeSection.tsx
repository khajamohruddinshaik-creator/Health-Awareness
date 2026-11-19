import { ArrowRight, CheckSquare, Droplets, HeartPulse, Sparkles } from 'lucide-react';
import { HERO_IMAGE } from '../data/healthContent';
import type { PortalSection } from '../types/health';
import { ResilientImage } from './ResilientImage';

interface HomeSectionProps {
  userName: string;
  checklistCount: number;
  totalChecklist: number;
  lastQuizScore: number | null;
  onNavigate: (section: PortalSection) => void;
}

export function HomeSection({
  userName,
  checklistCount,
  totalChecklist,
  lastQuizScore,
  onNavigate,
}: HomeSectionProps) {
  const checklistPct = Math.round((checklistCount / totalChecklist) * 100);

  return (
    <div className="space-y-10">
      {/* Editorial 2-Column Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
        <div className="lg:col-span-6 bg-white border border-[#DCE6E0] rounded-2xl p-6 sm:p-10 flex flex-col justify-between gap-8">
          <div className="space-y-4">
            <p className="text-xs font-medium text-[#146C43]">
              Welcome back, {userName} · Healthy Habits, Healthy Life
            </p>
            <h1 className="text-[clamp(2.25rem,3.8vw,3.35rem)] font-bold leading-[1.1] tracking-tight text-[#14241B] text-balance">
              Welcome to Health &amp; Hygiene
            </h1>
            <p className="text-base text-[#495D52] leading-relaxed max-w-xl">
              Good health starts with good hygiene habits. Learn practical daily
              routines to keep yourself, your nutrition, and your surroundings
              clean and safe.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => onNavigate('checklist')}
              className="inline-flex items-center gap-2 px-5 py-3 min-h-11 text-sm font-semibold text-white bg-[#146C43] rounded-lg hover:bg-[#0F5333] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Open Daily Checklist</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('awareness')}
              className="inline-flex items-center gap-2 px-4 py-3 min-h-11 text-sm font-semibold text-[#14241B] bg-[#F2F7F4] border border-[#DCE6E0] rounded-lg hover:bg-[#E7F0EB] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Explore Awareness Guide</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-[#DCE6E0] rounded-2xl overflow-hidden min-h-[260px]">
          <ResilientImage
            src={HERO_IMAGE}
            alt="Sunlit wellness vanity with soap dispenser, fresh white towels, and drinking water carafe"
            className="w-full h-full lg:h-full object-cover aspect-video lg:aspect-auto"
            fallbackTitle="Health & Hygiene Awareness"
          />
        </div>
      </section>

      {/* Full-Width 3-Pillar Strip */}
      <section aria-label="Core Hygiene Pillars" className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
          type="button"
          onClick={() => onNavigate('awareness')}
          className="text-left bg-white border border-[#DCE6E0] rounded-2xl p-6 hover:border-[#146C43]/50 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono font-medium text-[#5B7064]">01</span>
            <Sparkles className="w-5 h-5 text-[#146C43]" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-bold text-[#14241B] group-hover:text-[#146C43] transition-colors">
            Personal Hygiene
          </h2>
          <p className="text-sm text-[#495D52] leading-relaxed mt-2">
            Maintain body cleanliness, wash hands thoroughly with soap, and
            develop consistent daily care habits.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('food')}
          className="text-left bg-white border border-[#DCE6E0] rounded-2xl p-6 hover:border-[#146C43]/50 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono font-medium text-[#5B7064]">02</span>
            <HeartPulse className="w-5 h-5 text-[#146C43]" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-bold text-[#14241B] group-hover:text-[#146C43] transition-colors">
            Healthy Nutrition
          </h2>
          <p className="text-sm text-[#495D52] leading-relaxed mt-2">
            Eat balanced meals and include seasonal fruits, leafy vegetables,
            and clean protein sources every day.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('food')}
          className="text-left bg-white border border-[#DCE6E0] rounded-2xl p-6 hover:border-[#146C43]/50 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono font-medium text-[#5B7064]">03</span>
            <Droplets className="w-5 h-5 text-[#146C43]" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-bold text-[#14241B] group-hover:text-[#146C43] transition-colors">
            Safe Drinking Water
          </h2>
          <p className="text-sm text-[#495D52] leading-relaxed mt-2">
            Drink clean, filtered or boiled water consistently to prevent
            waterborne illnesses and stay hydrated.
          </p>
        </button>
      </section>

      {/* About Our Project + Personal Progress Snapshot */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white border border-[#DCE6E0] rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#14241B]">
              About Our Project
            </h2>
            <p className="text-sm sm:text-base text-[#495D52] leading-relaxed mt-3">
              The Health and Hygiene Awareness website provides clear, practical
              information about personal cleanliness, healthy food, hand
              washing, sanitation, and disease prevention. Its goal is to
              encourage everyday people to follow sustainable healthy habits in
              their daily lives.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-[#E6EFEA]">
            <button
              type="button"
              onClick={() => onNavigate('quiz')}
              className="text-sm font-semibold text-[#146C43] hover:underline cursor-pointer"
            >
              Take the 5-Question Quiz
            </button>
            <span aria-hidden="true" className="text-[#B8C7BE]">·</span>
            <button
              type="button"
              onClick={() => onNavigate('chat')}
              className="text-sm font-semibold text-[#146C43] hover:underline cursor-pointer"
            >
              Ask Hygiene Chat
            </button>
            <span aria-hidden="true" className="text-[#B8C7BE]">·</span>
            <button
              type="button"
              onClick={() => onNavigate('contact')}
              className="text-sm font-medium text-[#495D52] hover:text-[#14241B] hover:underline cursor-pointer"
            >
              Contact &amp; Project Info
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-[#DCE6E0] rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-5">
          <div>
            <p className="text-xs font-medium text-[#5B7064]">Your Progress Summary</p>
            <h3 className="text-xl font-bold text-[#14241B] mt-1">
              Daily Habit Snapshot
            </h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#495D52] flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-[#146C43]" aria-hidden="true" />
                Today&apos;s Hygiene Checklist
              </span>
              <span className="font-mono font-semibold tabular-nums text-[#14241B]">
                {checklistCount} / {totalChecklist} ({checklistPct}%)
              </span>
            </div>
            <div className="w-full h-2.5 bg-[#EAF2ED] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#146C43] transition-all duration-200"
                style={{ width: `${checklistPct}%` }}
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E6EFEA] text-sm">
              <span className="text-[#495D52]">Latest Quiz Score</span>
              <span className="font-mono font-semibold tabular-nums text-[#14241B]">
                {lastQuizScore !== null ? `${lastQuizScore} / 5` : 'Not taken yet'}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
