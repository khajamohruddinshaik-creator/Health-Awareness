import { Droplets, Minus, Plus } from 'lucide-react';
import { NUTRITION_IMAGE, NUTRITION_ITEMS } from '../data/healthContent';
import { ResilientImage } from './ResilientImage';

interface HealthyFoodSectionProps {
  hydrationGlasses: number;
  onUpdateHydration: (count: number) => void;
}

export function HealthyFoodSection({
  hydrationGlasses,
  onUpdateHydration,
}: HealthyFoodSectionProps) {
  return (
    <div className="space-y-8">
      {/* Split Feature: Balanced Plate Visual + Hydration Tracker */}
      <section className="bg-white border border-[#DCE6E0] rounded-2xl p-6 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-6 aspect-4/3 rounded-xl overflow-hidden bg-[#EAF2ED] border border-[#DCE6E0]">
            <ResilientImage
              src={NUTRITION_IMAGE}
              alt="Fresh spinach, broccoli, seasonal oranges, bowl of lentils and almonds, and glass of clean water"
              className="w-full h-full object-cover"
              fallbackTitle="Healthy Food and Nutrition"
            />
          </div>

          <div className="lg:col-span-6 flex flex-col justify-between gap-6">
            <div>
              <p className="text-xs font-medium text-[#146C43] mb-2">
                Daily Dietary Balance
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#14241B] text-balance">
                Healthy Food and Nutrition
              </h1>
              <p className="text-sm sm:text-base text-[#495D52] leading-relaxed mt-3">
                Clean, balanced nutrition fuels immunity, supports healthy
                growth, and complements daily personal hygiene. Combine fresh
                produce, reliable proteins, and safe drinking water in every
                day&apos;s routine.
              </p>
            </div>

            <div className="bg-[#F6F9F7] border border-[#DCE6E0] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <Droplets className="w-5 h-5 text-[#146C43]" aria-hidden="true" />
                  <div>
                    <h2 className="text-sm font-bold text-[#14241B]">
                      Daily Safe Water Tracker
                    </h2>
                    <p className="text-xs text-[#495D52]">
                      Target: 8 glasses of clean water today
                    </p>
                  </div>
                </div>
                <span className="text-lg font-bold font-mono tabular-nums text-[#14241B]">
                  {hydrationGlasses} / 8
                </span>
              </div>

              <div className="grid grid-cols-8 gap-2" aria-label="Water glasses progress">
                {Array.from({ length: 8 }).map((_, idx) => {
                  const filled = idx < hydrationGlasses;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onUpdateHydration(idx + 1)}
                      aria-label={`Set water intake to ${idx + 1} glasses`}
                      className={`h-8 rounded-md border transition-colors cursor-pointer ${
                        filled
                          ? 'bg-[#146C43] border-[#146C43]'
                          : 'bg-white border-[#CFDCD4] hover:border-[#146C43]'
                      }`}
                    />
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onUpdateHydration(Math.max(0, hydrationGlasses - 1))}
                  disabled={hydrationGlasses <= 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-10 text-xs font-medium text-[#14241B] bg-white border border-[#CFDCD4] rounded-lg hover:bg-[#EEF3F0] disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Remove Glass</span>
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateHydration(Math.min(8, hydrationGlasses + 1))}
                  disabled={hydrationGlasses >= 8}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-10 text-xs font-semibold text-white bg-[#146C43] rounded-lg hover:bg-[#0F5333] disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Add Glass</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6 Nutrition Food Groups Grid */}
      <section className="bg-white border border-[#DCE6E0] rounded-2xl p-6 sm:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-[#14241B]">
            Six Essential Nutrition Groups
          </h2>
          <p className="text-sm text-[#495D52] mt-1">
            Practical everyday food choices for balanced energy and immunity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {NUTRITION_ITEMS.map((item) => (
            <article
              key={item.id}
              className="bg-[#F9FCFA] border border-[#DCE6E0] rounded-xl p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2 text-xs text-[#5B7064] mb-2">
                  <span className="font-mono font-semibold text-[#146C43]">
                    {item.number}.
                  </span>
                  <span>{item.focus}</span>
                </div>
                <h3 className="text-lg font-bold text-[#14241B]">{item.title}</h3>
                <p className="text-sm text-[#495D52] leading-relaxed mt-2">
                  {item.description}
                </p>
              </div>
              <p className="text-xs text-[#374B40] pt-3 border-t border-[#E6EFEA]">
                {item.examples}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
