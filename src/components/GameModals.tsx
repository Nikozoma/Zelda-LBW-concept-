import React from 'react';
import { HudSnapshot } from '../game/types';

interface GameModalsProps {
  hud: HudSnapshot;
  touchEnabled: boolean;
  onToggleTouch: () => void;
  onResume: () => void;
  onRestart: () => void;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const GameModals: React.FC<GameModalsProps> = ({
  hud,
  touchEnabled,
  onToggleTouch,
  onResume,
  onRestart,
}) => {
  if (hud.phase !== 'PAUSED' && hud.phase !== 'VICTORY' && hud.phase !== 'GAME_OVER') {
    return null;
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-[#070a11]/78">
      <div className="w-full max-w-md rounded-xl bg-[#111723] border border-amber-300/25 p-7 shadow-2xl text-center">
        {hud.phase === 'PAUSED' && (
          <>
            <h2 className="font-display text-2xl font-bold text-amber-200">Quest Paused</h2>
            <p className="mt-2 text-sm text-slate-300">{hud.objectiveText}</p>

            <div className="mt-5 py-3 border-y border-slate-800 text-xs text-slate-300 space-y-1.5 text-left">
              <div><span className="text-amber-300 font-semibold">Move:</span> WASD, Arrows, or Left Thumbstick</div>
              <div><span className="text-amber-300 font-semibold">Sword:</span> Space / J / Click / Sword Button</div>
              <div><span className="text-amber-300 font-semibold">Wall-Merge:</span> E / Shift / Merge Button beside wall</div>
              <div><span className="text-amber-300 font-semibold">Items:</span> 1-3 + F / Right-Click / Item Button</div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-300">
              <span>On-Screen Touch Controls</span>
              <button
                type="button"
                onClick={onToggleTouch}
                className={`px-3 py-1.5 rounded-md border font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  touchEnabled
                    ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                {touchEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onResume}
                className="px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                Restart
              </button>
            </div>
          </>
        )}

        {hud.phase === 'VICTORY' && (
          <>
            <div className="flex justify-center mb-3">
              <svg viewBox="0 0 64 56" className="w-14 h-12" aria-hidden="true">
                <polygon points="32,4 18,28 46,28" fill="#facc15" stroke="#fef08a" strokeWidth="1.5" />
                <polygon points="18,28 4,52 32,52" fill="#eab308" stroke="#fef08a" strokeWidth="1.5" />
                <polygon points="46,28 32,52 60,52" fill="#eab308" stroke="#fef08a" strokeWidth="1.5" />
              </svg>
            </div>
            <h2 className="font-display text-3xl font-extrabold text-amber-200">
              Pendant Claimed
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              You mastered wall-merging across Hyrule and Lorule and vanquished the Eastern Sanctuary guardian.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3 py-3 border-y border-slate-800 text-center">
              <div>
                <div className="text-[11px] text-slate-400">Time</div>
                <div className="font-mono-nums text-base font-bold text-slate-100">
                  {formatDuration(hud.stats.timeSeconds)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Foes Defeated</div>
                <div className="font-mono-nums text-base font-bold text-slate-100">
                  {hud.stats.enemiesDefeated}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Rupees</div>
                <div className="font-mono-nums text-base font-bold text-emerald-300">
                  {hud.rupees}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onRestart}
              className="mt-6 w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              Play Again
            </button>
          </>
        )}

        {hud.phase === 'GAME_OVER' && (
          <>
            <h2 className="font-display text-3xl font-extrabold text-rose-300">Fallen in Battle</h2>
            <p className="mt-2 text-sm text-slate-300">
              The shadow between worlds proved too fierce. Rise again, hero.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3 py-3 border-y border-slate-800 text-center">
              <div>
                <div className="text-[11px] text-slate-400">Time</div>
                <div className="font-mono-nums text-base font-bold text-slate-100">
                  {formatDuration(hud.stats.timeSeconds)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Fissures</div>
                <div className="font-mono-nums text-base font-bold text-purple-300">
                  {hud.stats.fissuresCrossed}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Rupees</div>
                <div className="font-mono-nums text-base font-bold text-emerald-300">
                  {hud.rupees}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onRestart}
              className="mt-6 w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              Play Again
            </button>
          </>
        )}
      </div>
    </div>
  );
};
