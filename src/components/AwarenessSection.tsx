import { useEffect, useState } from 'react';
import { Check, Play, RotateCcw, Timer } from 'lucide-react';
import {
  AWARENESS_TOPICS,
  HANDWASHING_IMAGE,
  HANDWASHING_STEPS,
} from '../data/healthContent';
import { ResilientImage } from './ResilientImage';

export function AwarenessSection() {
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(20);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    if (!timerRunning) return;
    if (secondsLeft <= 0) {
      setTimerRunning(false);
      return;
    }
    const id = window.setTimeout(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [timerRunning, secondsLeft]);

  const toggleStep = (stepNumber: number) => {
    setCompletedSteps((prev) =>
      prev.includes(stepNumber)
        ? prev.filter((n) => n !== stepNumber)
        : [...prev, stepNumber]
    );
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setSecondsLeft(20);
  };

  return (
    <div className="space-y-10">
      <div className="bg-white border border-[#DCE6E0] rounded-2xl p-6 sm:p-8">
        <div className="max-w-2xl mb-8">
          <p className="text-xs font-medium text-[#146C43] mb-2">
            Core Preventive Practices
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#14241B] text-balance">
            Health and Hygiene Awareness
          </h1>
          <p className="text-sm sm:text-base text-[#495D52] mt-2 leading-relaxed">
            Six everyday practices that reduce infection risk, support physical
            vitality, and keep your living environment clean.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {AWARENESS_TOPICS.map((topic) => (
            <article
              key={topic.id}
              className="bg-[#F9FCFA] border border-[#DCE6E0] rounded-xl p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2 text-xs text-[#5B7064] mb-2">
                  <span className="font-mono font-semibold text-[#146C43]">
                    {topic.number}.
                  </span>
                  <span>{topic.category}</span>
                </div>
                <h2 className="text-lg font-bold text-[#14241B]">
                  {topic.title}
                </h2>
                <p className="text-sm text-[#495D52] leading-relaxed mt-2">
                  {topic.description}
                </p>
              </div>
              <p className="text-xs text-[#374B40] pt-3 border-t border-[#E6EFEA]">
                Daily focus: {topic.dailyAction}
              </p>
            </article>
          ))}
        </div>
      </div>

      {/* Interactive Hand Washing Walkthrough */}
      <section className="bg-white border border-[#DCE6E0] rounded-2xl p-6 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-5 flex flex-col justify-between gap-5">
            <div className="aspect-4/3 rounded-xl overflow-hidden bg-[#EAF2ED] border border-[#DCE6E0]">
              <ResilientImage
                src={HANDWASHING_IMAGE}
                alt="Hands washing with soap lather under clean running water"
                className="w-full h-full object-cover"
                fallbackTitle="Proper Hand Washing"
              />
            </div>

            <div className="bg-[#F6F9F7] border border-[#DCE6E0] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-[#5B7064]">
                    20-Second Scrub Timer
                  </p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-[#14241B] mt-0.5">
                    {secondsLeft}s
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (secondsLeft === 0) setSecondsLeft(20);
                      setTimerRunning((r) => !r);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 min-h-10 text-sm font-semibold text-white bg-[#146C43] rounded-lg hover:bg-[#0F5333] transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {timerRunning ? (
                      <>
                        <Timer className="w-4 h-4" aria-hidden="true" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" aria-hidden="true" />
                        <span>{secondsLeft === 0 ? 'Restart' : 'Start Timer'}</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={resetTimer}
                    aria-label="Reset 20-second handwashing timer"
                    className="inline-flex items-center justify-center p-2.5 min-h-10 min-w-10 text-[#374B40] bg-white border border-[#CFDCD4] rounded-lg hover:bg-[#EEF3F0] transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-[#495D52]">
                {secondsLeft === 0
                  ? 'Complete: 20 seconds reached. Rinse with clean water and dry.'
                  : 'Lather with soap for a full 20 seconds before rinsing.'}
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col justify-between gap-6">
            <div>
              <p className="text-xs font-medium text-[#146C43] mb-1">
                Step-by-Step Technique
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-[#14241B]">
                Steps for Proper Hand Washing
              </h2>
              <p className="text-sm text-[#495D52] mt-1">
                Click each step below as you practice the full 6-step sequence.
              </p>
            </div>

            <ol className="space-y-3">
              {HANDWASHING_STEPS.map((item) => {
                const done = completedSteps.includes(item.step);
                return (
                  <li key={item.step}>
                    <button
                      type="button"
                      onClick={() => toggleStep(item.step)}
                      className={`w-full text-left flex items-center justify-between gap-4 p-4 rounded-xl border transition-colors cursor-pointer ${
                        done
                          ? 'bg-[#EEF7F2] border-[#9FD0B4]'
                          : 'bg-white border-[#DCE6E0] hover:bg-[#F8FBF9]'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <span
                          className={`font-mono text-sm font-semibold tabular-nums mt-0.5 ${
                            done ? 'text-[#0F5333]' : 'text-[#5B7064]'
                          }`}
                        >
                          0{item.step}.
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-[#14241B]">
                            {item.title}
                          </p>
                          <p className="text-sm text-[#495D52] mt-0.5">
                            {item.instruction}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${
                          done
                            ? 'bg-[#146C43] border-[#146C43] text-white'
                            : 'border-[#B8C7BE] bg-white'
                        }`}
                      >
                        {done && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="flex items-center justify-between text-xs text-[#495D52] pt-2 border-t border-[#E6EFEA]">
              <span className="font-mono tabular-nums">
                {completedSteps.length} / {HANDWASHING_STEPS.length} steps practiced
              </span>
              {completedSteps.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCompletedSteps([])}
                  className="font-medium text-[#146C43] hover:underline cursor-pointer"
                >
                  Clear steps
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
