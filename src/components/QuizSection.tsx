import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  RotateCcw,
  Shuffle,
} from 'lucide-react';
import { generateRandomQuiz } from '../data/healthContent';
import type { QuizQuestion } from '../types/health';

const QUESTION_DURATION_SECONDS = 30;

interface QuizSectionProps {
  onScoreSaved: (score: number) => void;
}

export function QuizSection({ onScoreSaved }: QuizSectionProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>(() =>
    generateRandomQuiz()
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_DURATION_SECONDS);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timedOutIds, setTimedOutIds] = useState<string[]>([]);
  const [submittedScore, setSubmittedScore] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const currentQuestion = questions[currentIndex];
  const isFinished = submittedScore !== null;
  const isLastQuestion = currentIndex === questions.length - 1;

  const finalizeQuiz = useCallback(
    (finalAnswers: Record<string, string>) => {
      let score = 0;
      for (const q of questions) {
        if (finalAnswers[q.id] === q.correctAnswer) {
          score++;
        }
      }
      setSubmittedScore(score);
      onScoreSaved(score);
    },
    [onScoreSaved, questions]
  );

  // 30-second per-question countdown timer
  useEffect(() => {
    if (isFinished || !currentQuestion) return;

    const timerId = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timerId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [currentIndex, isFinished, currentQuestion]);

  // Auto-advance or auto-submit when the 30-second timer reaches 0
  useEffect(() => {
    if (isFinished || timeLeft > 0 || !currentQuestion) return;

    if (!answers[currentQuestion.id]) {
      setTimedOutIds((prev) =>
        prev.includes(currentQuestion.id) ? prev : [...prev, currentQuestion.id]
      );
    }

    setValidationError(null);

    if (isLastQuestion) {
      finalizeQuiz(answers);
    } else {
      setCurrentIndex((prev) => prev + 1);
      setTimeLeft(QUESTION_DURATION_SECONDS);
    }
  }, [
    timeLeft,
    isFinished,
    currentQuestion,
    answers,
    isLastQuestion,
    finalizeQuiz,
  ]);

  const handleSelectOption = (questionId: string, optionValue: string) => {
    setValidationError(null);
    setAnswers((prev) => ({ ...prev, [questionId]: optionValue }));
  };

  const handleAdvance = (e: FormEvent) => {
    e.preventDefault();
    if (!currentQuestion) return;

    if (!answers[currentQuestion.id]) {
      setValidationError('Please select an answer before continuing.');
      return;
    }

    setValidationError(null);
    if (isLastQuestion) {
      finalizeQuiz(answers);
    } else {
      setCurrentIndex((prev) => prev + 1);
      setTimeLeft(QUESTION_DURATION_SECONDS);
    }
  };

  const handleNewQuestions = () => {
    const previousIds = questions.map((q) => q.id);
    setQuestions(generateRandomQuiz(previousIds));
    setCurrentIndex(0);
    setTimeLeft(QUESTION_DURATION_SECONDS);
    setAnswers({});
    setTimedOutIds([]);
    setSubmittedScore(null);
    setValidationError(null);
  };

  const timerPct = Math.round((timeLeft / QUESTION_DURATION_SECONDS) * 100);
  const isCriticalTime = timeLeft <= 5;
  const isLowTime = timeLeft > 5 && timeLeft <= 10;

  return (
    <div className="bg-white border border-[#DCE6E0] rounded-2xl p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#E6EFEA]">
        <div>
          <p className="text-xs font-medium text-[#146C43] mb-1">
            Timed Knowledge Assessment
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#14241B]">
            Health and Hygiene Quiz
          </h1>
          <p className="text-sm text-[#495D52] mt-1">
            Five randomized questions with a 30-second countdown per question.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isFinished ? (
            <div className="px-4 py-2.5 bg-[#EEF7F2] border border-[#C4E2D0] rounded-xl">
              <p className="text-xs text-[#0F5333]">Final Result</p>
              <p className="text-lg font-bold font-mono tabular-nums text-[#0F5333]">
                Your Score: {submittedScore} / {questions.length}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleNewQuestions}
              className="inline-flex items-center gap-2 px-4 py-2 min-h-10 text-sm font-medium text-[#14241B] bg-[#F2F7F4] border border-[#CFDCD4] rounded-lg hover:bg-[#E7F0EB] transition-colors whitespace-nowrap cursor-pointer"
            >
              <Shuffle className="w-4 h-4 text-[#146C43]" aria-hidden="true" />
              <span>New Questions</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Timed Question */}
      {!isFinished && currentQuestion && (
        <form onSubmit={handleAdvance} className="space-y-6">
          {/* Progress + Countdown Bar */}
          <div className="p-4 rounded-xl bg-[#F6F9F7] border border-[#DCE6E0] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-semibold font-mono tabular-nums text-[#14241B]">
                Question {currentIndex + 1} / {questions.length}
              </span>

              <div
                aria-live="polite"
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border text-sm font-semibold font-mono tabular-nums ${
                  isCriticalTime
                    ? 'bg-[#FDF3F2] border-[#F2CFCB] text-[#9E2A22]'
                    : isLowTime
                      ? 'bg-[#FEF8EC] border-[#F2DCB1] text-[#8A5300]'
                      : 'bg-white border-[#DCE6E0] text-[#14241B]'
                }`}
              >
                <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{timeLeft}s remaining</span>
                {isCriticalTime && (
                  <span className="font-sans text-xs font-semibold">
                    (Hurry)
                  </span>
                )}
              </div>
            </div>

            <div className="w-full h-2 bg-[#E2EBE5] rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  isCriticalTime
                    ? 'bg-[#B92B27]'
                    : isLowTime
                      ? 'bg-[#B4690E]'
                      : 'bg-[#146C43]'
                }`}
                style={{ width: `${timerPct}%` }}
              />
            </div>
          </div>

          {validationError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#FDF3F2] border border-[#F2CFCB] text-sm text-[#9E2A22]"
            >
              <AlertCircle
                className="w-4 h-4 mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span>{validationError}</span>
            </div>
          )}

          <fieldset className="p-5 sm:p-6 rounded-xl border border-[#DCE6E0] bg-[#F9FCFA] space-y-4">
            <legend className="text-base sm:text-lg font-semibold text-[#14241B]">
              <span className="font-mono text-[#146C43] mr-2">
                {currentQuestion.number}.
              </span>
              {currentQuestion.prompt}
            </legend>

            <div className="space-y-2.5 pt-1">
              {currentQuestion.options.map((opt) => {
                const checked = answers[currentQuestion.id] === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-3 p-3.5 min-h-12 rounded-lg border text-sm transition-colors cursor-pointer ${
                      checked
                        ? 'bg-white border-[#146C43] text-[#14241B] font-medium'
                        : 'bg-white/75 border-[#DCE6E0] text-[#374B40] hover:bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name={currentQuestion.id}
                      value={opt.value}
                      checked={checked}
                      onChange={() =>
                        handleSelectOption(currentQuestion.id, opt.value)
                      }
                      className="accent-[#146C43] w-4 h-4"
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-[#5B7064]">
              Automatically advances when the 30-second timer expires.
            </p>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-2.5 min-h-11 text-sm font-semibold text-white bg-[#146C43] rounded-lg hover:bg-[#0F5333] transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>{isLastQuestion ? 'Submit Quiz' : 'Next Question'}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </form>
      )}

      {/* Results Review */}
      {isFinished && (
        <div className="space-y-6">
          {timedOutIds.length > 0 && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-[#FEF8EC] border border-[#F2DCB1] text-sm text-[#8A5300]">
              <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="font-mono tabular-nums">
                {timedOutIds.length} of {questions.length}
              </span>
              <span>
                {timedOutIds.length === 1 ? 'question' : 'questions'} timed out
                before an answer was selected.
              </span>
            </div>
          )}

          <div className="space-y-4">
            {questions.map((q) => {
              const selected = answers[q.id];
              const isCorrect = selected === q.correctAnswer;
              const didTimeout = timedOutIds.includes(q.id) && !selected;
              const selectedLabel = q.options.find(
                (o) => o.value === selected
              )?.label;
              const correctLabel = q.options.find(
                (o) => o.value === q.correctAnswer
              )?.label;

              return (
                <article
                  key={q.id}
                  className="p-5 rounded-xl border border-[#DCE6E0] bg-[#F9FCFA] space-y-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-sm sm:text-base font-semibold text-[#14241B]">
                      <span className="font-mono text-[#146C43] mr-2">
                        {q.number}.
                      </span>
                      {q.prompt}
                    </h2>

                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                        isCorrect
                          ? 'text-[#0F5333]'
                          : didTimeout
                            ? 'text-[#8A5300]'
                            : 'text-[#9E2A22]'
                      }`}
                    >
                      {isCorrect ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                          <span>Correct</span>
                        </>
                      ) : didTimeout ? (
                        <>
                          <Clock className="w-4 h-4" aria-hidden="true" />
                          <span>Timed Out</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4" aria-hidden="true" />
                          <span>Needs Review</span>
                        </>
                      )}
                    </span>
                  </div>

                  <p className="text-xs text-[#374B40]">
                    Your answer:{' '}
                    <span className="font-medium">
                      {selectedLabel ?? 'No answer selected'}
                    </span>
                    {!isCorrect && correctLabel && (
                      <>
                        {' · '}Correct answer:{' '}
                        <span className="font-semibold text-[#0F5333]">
                          {correctLabel}
                        </span>
                      </>
                    )}
                  </p>

                  <p className="text-xs text-[#495D52] pt-2 border-t border-[#E6EFEA]">
                    {q.explanation}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleNewQuestions}
              className="inline-flex items-center gap-2 px-5 py-2.5 min-h-11 text-sm font-semibold text-white bg-[#146C43] rounded-lg hover:bg-[#0F5333] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Retake With New Questions</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
