import React from 'react';
import { Pause, Volume2, VolumeX } from 'lucide-react';
import { HudSnapshot, ItemId } from '../game/types';

interface HudOverlayProps {
  hud: HudSnapshot;
  touchEnabled: boolean;
  onSelectItem: (item: ItemId) => void;
  onToggleMute: () => void;
  onPause: () => void;
}

const ITEM_META: Record<ItemId, { key: string; name: string }> = {
  bow: { key: '1', name: 'Bow' },
  bomb: { key: '2', name: 'Bomb' },
  boomerang: { key: '3', name: 'Boomerang' },
};

const HeartIcon: React.FC<{ state: 'full' | 'half' | 'empty' }> = ({ state }) => (
  <svg viewBox="0 0 24 22" className="w-5 h-5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" aria-hidden="true">
    <path
      d="M12 20.4l-1.45-1.32C5.4 14.36 2 11.28 2 7.5 2 4.42 4.42 2 7.5 2c1.74 0 3.41.81 4.5 2.09C13.09 2.81 14.76 2 16.5 2 19.58 2 22 4.42 22 7.5c0 3.78-3.4 6.86-8.55 11.54L12 20.4z"
      fill="#1e293b"
      stroke="#0f172a"
      strokeWidth="1.5"
    />
    {state === 'full' && (
      <path
        d="M12 20.4l-1.45-1.32C5.4 14.36 2 11.28 2 7.5 2 4.42 4.42 2 7.5 2c1.74 0 3.41.81 4.5 2.09C13.09 2.81 14.76 2 16.5 2 19.58 2 22 4.42 22 7.5c0 3.78-3.4 6.86-8.55 11.54L12 20.4z"
        fill="#f43f5e"
      />
    )}
    {state === 'half' && (
      <path
        d="M12 20.4l-1.45-1.32C5.4 14.36 2 11.28 2 7.5 2 4.42 4.42 2 7.5 2c1.74 0 3.41.81 4.5 2.09V20.4z"
        fill="#f43f5e"
      />
    )}
  </svg>
);

const ItemSvg: React.FC<{ item: ItemId; unlocked: boolean }> = ({ item, unlocked }) => {
  const stroke = unlocked ? '#fef08a' : '#64748b';
  if (item === 'bow') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
        <path d="M5 19C12 19 19 12 19 5" />
        <line x1="5" y1="19" x2="19" y2="5" strokeOpacity="0.45" />
        <line x1="4" y1="20" x2="20" y2="4" stroke="#38bdf8" strokeWidth="1.8" />
      </svg>
    );
  }
  if (item === 'bomb') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
        <circle cx="11" cy="14" r="7" fill={unlocked ? '#334155' : '#1e293b'} stroke={stroke} strokeWidth="1.8" />
        <path d="M15 8l3-3" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" />
        <circle cx="19" cy="4" r="1.8" fill={unlocked ? '#fde047' : '#64748b'} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke={unlocked ? '#38bdf8' : '#64748b'} strokeWidth="3" strokeLinecap="round">
      <path d="M5 7c7 0 12 5 12 12" />
    </svg>
  );
};

export const HudOverlay: React.FC<HudOverlayProps> = ({
  hud,
  touchEnabled,
  onSelectItem,
  onToggleMute,
  onPause,
}) => {
  const totalHearts = Math.ceil(hud.maxHp / 2);
  const hearts = Array.from({ length: totalHearts }, (_, i) => {
    const val = hud.hp - i * 2;
    if (val >= 2) return 'full';
    if (val === 1) return 'half';
    return 'empty';
  });

  const worldLabel =
    hud.world === 'hyrule'
      ? 'Hyrule Overworld'
      : hud.world === 'lorule'
      ? 'Lorule Overworld'
      : 'Eastern Sanctuary';

  const staminaPct = Math.max(0, Math.min(100, (hud.stamina / hud.maxStamina) * 100));

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 sm:p-5"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      {/* Top Perimeter Row */}
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        {/* Top-Left: Hearts + ALBW Stamina/Energy Bar */}
        <div className="flex flex-col gap-1.5 sm:gap-2 bg-[#0d121c]/82 border border-amber-200/18 rounded-lg px-2.5 py-2 sm:px-3.5 sm:py-2.5 shadow-lg">
          <div className="flex items-center gap-0.5 sm:gap-1" aria-label={`Health ${hud.hp} of ${hud.maxHp}`}>
            {hearts.map((state, idx) => (
              <HeartIcon key={idx} state={state} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-slate-300">
              {hud.merged ? 'Mural' : 'Energy'}
            </span>
            <div className="w-20 sm:w-32 h-2 sm:h-2.5 rounded-sm bg-slate-900 border border-slate-700 overflow-hidden">
              <div
                className={`h-full transition-colors duration-150 ${
                  hud.merged
                    ? 'bg-sky-400'
                    : staminaPct < 25
                    ? 'bg-rose-400'
                    : 'bg-gradient-to-r from-violet-500 to-emerald-400'
                }`}
                style={{ width: `${staminaPct}%` }}
              />
            </div>
            <span className="font-mono-nums text-[11px] text-slate-300 w-7 text-right">
              {Math.round(hud.stamina)}
            </span>
          </div>
        </div>

        {/* Top-Center: World & Current Quest Goal (quiet unboxed text) */}
        <div className="hidden md:flex flex-col items-center text-center bg-[#0d121c]/75 border border-slate-700/60 rounded-lg px-4 py-2 max-w-md">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide">
            <span
              className={
                hud.world === 'lorule'
                  ? 'text-purple-300'
                  : hud.world === 'dungeon'
                  ? 'text-sky-300'
                  : 'text-amber-300'
              }
            >
              {worldLabel}
            </span>
            <span className="text-slate-500" aria-hidden="true">·</span>
            <span className="text-slate-200 truncate max-w-xs">{hud.objectiveText}</span>
          </div>
        </div>

        {/* Top-Right: Rupees, Keys, Item Slots, Audio & Pause */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Counters */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 bg-[#0d121c]/82 border border-amber-200/18 rounded-lg px-2.5 py-2 sm:px-3.5 shadow-lg">
            <div className="flex items-center gap-1 sm:gap-1.5" title="Rupees">
              <svg viewBox="0 0 16 20" className="w-3.5 h-4.5" aria-hidden="true">
                <polygon points="8,1 15,6 15,14 8,19 1,14 1,6" fill="#22c55e" stroke="#bbf7d0" strokeWidth="1.2" />
              </svg>
              <span className="font-mono-nums text-xs sm:text-sm font-bold text-emerald-300">{hud.rupees}</span>
            </div>
            <span className="text-slate-600" aria-hidden="true">|</span>
            <div className="flex items-center gap-1 sm:gap-1.5" title="Small Keys">
              <svg viewBox="0 0 20 20" className="w-4 h-4" aria-hidden="true">
                <circle cx="7" cy="7" r="4" fill="none" stroke="#facc15" strokeWidth="2" />
                <path d="M10 10l7 7M14 14l2-2" stroke="#facc15" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="font-mono-nums text-xs sm:text-sm font-bold text-amber-300">{hud.keys}</span>
            </div>
          </div>

          {/* Interactive Item Slots (hidden on narrow mobile when thumb cluster handles items) */}
          <div className={`pointer-events-auto items-center gap-1.5 bg-[#0d121c]/85 border border-amber-200/18 rounded-lg p-1 shadow-lg ${touchEnabled ? 'hidden sm:flex' : 'flex'}`}>
            {(['bow', 'bomb', 'boomerang'] as ItemId[]).map((itemId) => {
              const unlocked = hud.unlockedItems.includes(itemId);
              const active = hud.equippedItem === itemId;
              const meta = ITEM_META[itemId];
              return (
                <button
                  key={itemId}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => onSelectItem(itemId)}
                  title={unlocked ? `${meta.name} [${meta.key}]` : `${meta.name} (Locked)`}
                  className={`relative flex items-center justify-center w-10 h-10 rounded-md transition-colors duration-150 ${
                    active
                      ? 'bg-amber-500/25 border border-amber-400 text-amber-200 cursor-pointer'
                      : unlocked
                      ? 'bg-slate-800/80 border border-slate-700 hover:bg-slate-700 text-slate-200 cursor-pointer'
                      : 'bg-slate-900/60 border border-slate-800/80 opacity-45 cursor-not-allowed'
                  }`}
                >
                  <ItemSvg item={itemId} unlocked={unlocked} />
                  <span className="absolute bottom-0.5 right-1 font-mono-nums text-[10px] text-slate-300">
                    {meta.key}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Mute & Pause */}
          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={hud.muted ? 'Unmute audio' : 'Mute audio'}
              title="Toggle Mute (M)"
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#0d121c]/85 border border-slate-700 hover:border-amber-300/50 text-slate-200 transition-colors cursor-pointer"
            >
              {hud.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onPause}
              aria-label="Pause game"
              title="Pause (Esc)"
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#0d121c]/85 border border-slate-700 hover:border-amber-300/50 text-slate-200 transition-colors cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Middle Banner Toast (Area / Item Collected) */}
      <div className="flex flex-col items-center gap-2 my-auto pointer-events-none">
        {hud.bannerText && (
          <div className="bg-[#0d121c]/90 border border-amber-400/45 rounded-lg px-5 py-2.5 text-center shadow-xl max-w-lg">
            <p className="font-display text-sm sm:text-base font-bold text-amber-200 tracking-wide">
              {hud.bannerText}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Contextual Prompts & Boss Bar (lifted clear of smartphone touch controls) */}
      <div className={`flex flex-col items-center gap-2 ${touchEnabled ? 'mb-38 sm:mb-0' : ''}`}>
        {hud.bossHp !== null && hud.bossMaxHp !== null && (
          <div className="w-full max-w-md bg-[#0d121c]/88 border border-purple-400/40 rounded-lg px-4 py-2 shadow-xl">
            <div className="flex items-center justify-between text-xs font-semibold text-purple-200 mb-1.5">
              <span className="font-display tracking-wide">{hud.bossName}</span>
              <span className="font-mono-nums">
                {hud.bossHp} / {hud.bossMaxHp}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-900 rounded-sm overflow-hidden border border-purple-900/70">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-fuchsia-400 transition-all duration-150"
                style={{ width: `${(hud.bossHp / hud.bossMaxHp) * 100}%` }}
              />
            </div>
          </div>
        )}

        {hud.nearSignText && (
          <div className="bg-[#1b150e]/92 border border-amber-500/40 rounded-lg px-4 py-2.5 max-w-lg text-center shadow-lg">
            <p className="text-xs sm:text-sm text-amber-100">{hud.nearSignText}</p>
          </div>
        )}

        {!hud.nearSignText && (hud.canMergePrompt || hud.merged) && (
          <div className="bg-[#0d121c]/85 border border-sky-400/40 rounded-lg px-4 py-1.5 text-xs font-medium text-sky-200 shadow">
            {hud.merged
              ? 'Merged in Wall · Move along wall or into Fissure · Press E to Pop Out'
              : 'Press E near wall to Wall-Merge'}
          </div>
        )}
      </div>
    </div>
  );
};
