import React, { useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { HudSnapshot, ItemId } from '../game/types';

interface TouchControlsProps {
  hud: HudSnapshot;
  onMove: (x: number, y: number) => void;
  onAction: (action: 'sword' | 'merge' | 'item' | 'cycle') => void;
}

const MAX_RADIUS = 42;

const EquippedItemIcon: React.FC<{ item: ItemId | null }> = ({ item }) => {
  if (!item) {
    return (
      <svg viewBox="0 0 24 24" className="w-6 h-6 opacity-40" fill="none" stroke="#94a3b8" strokeWidth="2">
        <circle cx="12" cy="12" r="7" strokeDasharray="3 3" />
      </svg>
    );
  }
  if (item === 'bow') {
    return (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#fef08a" strokeWidth="2.2" strokeLinecap="round">
        <path d="M5 19C12 19 19 12 19 5" />
        <line x1="5" y1="19" x2="19" y2="5" strokeOpacity="0.45" />
        <line x1="4" y1="20" x2="20" y2="4" stroke="#38bdf8" strokeWidth="2" />
      </svg>
    );
  }
  if (item === 'bomb') {
    return (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
        <circle cx="11" cy="14" r="7" fill="#334155" stroke="#fef08a" strokeWidth="2" />
        <path d="M15 8l3-3" stroke="#fb923c" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="19" cy="4" r="2" fill="#fde047" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#38bdf8" strokeWidth="3.2" strokeLinecap="round">
      <path d="M5 7c7 0 12 5 12 12" />
    </svg>
  );
};

export const TouchControls: React.FC<TouchControlsProps> = ({ hud, onMove, onAction }) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const originRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [knob, setKnob] = useState<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  const updateStick = (clientX: number, clientY: number) => {
    const dx = clientX - originRef.current.x;
    const dy = clientY - originRef.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, MAX_RADIUS);
    const angle = Math.atan2(dy, dx);
    const kx = dist > 0 ? Math.cos(angle) * clamped : 0;
    const ky = dist > 0 ? Math.sin(angle) * clamped : 0;
    setKnob({ x: kx, y: ky, active: true });
    onMove(kx / MAX_RADIUS, ky / MAX_RADIUS);
  };

  const resetStick = () => {
    activePointerId.current = null;
    setKnob({ x: 0, y: 0, active: false });
    onMove(0, 0);
  };

  const handlePadPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (activePointerId.current !== null) return;
    activePointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);

    const rect = e.currentTarget.getBoundingClientRect();
    originRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    updateStick(e.clientX, e.clientY);
  };

  const handlePadPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.preventDefault();
    updateStick(e.clientX, e.clientY);
  };

  const handlePadPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.preventDefault();
    resetStick();
  };

  const itemShortLabel =
    hud.equippedItem === 'bow'
      ? 'Bow'
      : hud.equippedItem === 'bomb'
      ? 'Bomb'
      : hud.equippedItem === 'boomerang'
      ? 'Rang'
      : 'Item';

  const mergeHighlighted = hud.canMergePrompt || hud.merged;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 flex items-end justify-between px-4 pb-5 sm:px-7 sm:pb-7 select-none"
      style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
    >
      {/* Left: Virtual Thumbstick */}
      <div
        ref={padRef}
        onPointerDown={handlePadPointerDown}
        onPointerMove={handlePadPointerMove}
        onPointerUp={handlePadPointerUp}
        onPointerCancel={handlePadPointerUp}
        onLostPointerCapture={resetStick}
        aria-label="Movement thumbstick"
        className="pointer-events-auto touch-none relative w-36 h-36 flex items-center justify-center"
      >
        <div
          className={`relative w-28 h-28 rounded-full border transition-colors duration-100 flex items-center justify-center ${
            knob.active
              ? 'bg-[#0d121c]/80 border-amber-300/60'
              : 'bg-[#0d121c]/60 border-amber-200/25'
          }`}
        >
          {/* Subtle cardinal cues */}
          <span className="absolute top-2 text-[9px] text-amber-200/40 font-bold" aria-hidden="true">▲</span>
          <span className="absolute bottom-2 text-[9px] text-amber-200/40 font-bold" aria-hidden="true">▼</span>
          <span className="absolute left-2.5 text-[9px] text-amber-200/40 font-bold" aria-hidden="true">◀</span>
          <span className="absolute right-2.5 text-[9px] text-amber-200/40 font-bold" aria-hidden="true">▶</span>

          {/* Thumb Knob */}
          <div
            className={`w-12 h-12 rounded-full border-2 shadow-lg transition-colors duration-75 ${
              knob.active
                ? 'bg-amber-400/90 border-amber-100'
                : 'bg-amber-300/65 border-amber-100/75'
            }`}
            style={{
              transform: `translate3d(${knob.x}px, ${knob.y}px, 0)`,
            }}
          />
        </div>
      </div>

      {/* Right: Action Buttons Cluster */}
      <div className="pointer-events-auto touch-none relative w-44 h-40">
        {/* Swap Item Button (shown when 2+ items unlocked) */}
        {hud.unlockedItems.length > 1 && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAction('cycle');
            }}
            aria-label="Switch equipped item"
            className="absolute left-0 bottom-20 w-11 h-11 rounded-full bg-[#0d121c]/80 border border-slate-600/80 active:scale-90 text-slate-200 flex items-center justify-center shadow-lg transition-transform duration-75"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        {/* Use Equipped Item Button */}
        <button
          type="button"
          disabled={!hud.equippedItem || hud.merged}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAction('item');
          }}
          aria-label={`Use ${itemShortLabel}`}
          className={`absolute left-4 bottom-2 w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center shadow-lg active:scale-95 transition-transform duration-75 ${
            hud.equippedItem && !hud.merged
              ? 'bg-[#0d121c]/85 border-amber-400/75 text-amber-100'
              : 'bg-[#0d121c]/45 border-slate-700/60 text-slate-500 opacity-60'
          }`}
        >
          <EquippedItemIcon item={hud.equippedItem} />
          <span className="text-[9px] font-semibold tracking-wide leading-none mt-0.5">
            {itemShortLabel}
          </span>
        </button>

        {/* Wall-Merge Button */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAction('merge');
          }}
          aria-label={hud.merged ? 'Exit wall merge' : 'Wall merge'}
          className={`absolute right-2 bottom-20 w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center shadow-lg active:scale-95 transition-transform duration-75 ${
            mergeHighlighted
              ? 'bg-sky-400/90 border-sky-100 text-slate-950 shadow-[0_0_20px_rgba(56,189,248,0.55)]'
              : 'bg-[#0d121c]/80 border-sky-400/45 text-sky-200'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="4" y="3" width="16" height="18" rx="2" strokeOpacity="0.45" />
            <path d="M12 7v10M8 11l4-4 4 4" />
          </svg>
          <span className="text-[9px] font-bold tracking-wide leading-none mt-0.5">
            {hud.merged ? 'Exit' : 'Merge'}
          </span>
        </button>

        {/* Sword Primary Attack Button */}
        <button
          type="button"
          disabled={hud.merged}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAction('sword');
          }}
          aria-label="Sword attack"
          className={`absolute right-0 bottom-0 w-16 h-16 rounded-full border-2 flex flex-col items-center justify-center shadow-xl active:scale-95 transition-transform duration-75 ${
            hud.merged
              ? 'bg-[#0d121c]/45 border-slate-700/60 text-slate-500 opacity-55'
              : 'bg-emerald-600/90 border-emerald-200 text-white shadow-[0_4px_18px_rgba(16,185,129,0.4)]'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14.5 4.5L19.5 4.5L19.5 9.5L9 20L4 15L14.5 4.5Z" />
            <path d="M7 12L12 17" />
          </svg>
          <span className="text-[10px] font-bold tracking-wide leading-none mt-0.5">Sword</span>
        </button>
      </div>
    </div>
  );
};
