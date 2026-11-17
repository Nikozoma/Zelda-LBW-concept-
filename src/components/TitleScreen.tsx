import React, { useEffect } from 'react';

interface TitleScreenProps {
  onStart: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStart }) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onStart]);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-between px-6 py-12 bg-gradient-to-b from-[#090d16]/75 via-[#090d16]/40 to-[#090d16]/88">
      <div className="text-xs tracking-[0.22em] text-amber-200/75 uppercase">
        Hyrule <span aria-hidden="true">·</span> Lorule <span aria-hidden="true">·</span> Eastern Sanctuary
      </div>

      <div className="flex flex-col items-center text-center max-w-2xl">
        {/* Bespoke inline SVG Title Lockup */}
        <svg
          viewBox="0 0 180 76"
          className="w-40 h-18 mb-4 drop-shadow-[0_6px_18px_rgba(0,0,0,0.65)]"
          aria-hidden="true"
        >
          {/* Golden Hyrule Triforce */}
          <polygon points="58,10 42,36 74,36" fill="#facc15" stroke="#fef08a" strokeWidth="1.2" />
          <polygon points="42,36 26,62 58,62" fill="#eab308" stroke="#fef08a" strokeWidth="1.2" />
          <polygon points="74,36 58,62 90,62" fill="#eab308" stroke="#fef08a" strokeWidth="1.2" />

          {/* Dimensional Fissure Rift */}
          <path
            d="M90 6 L86 24 L95 39 L87 54 L91 70"
            fill="none"
            stroke="#e879f9"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M90 6 L86 24 L95 39 L87 54 L91 70"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Inverted Violet Lorule Triforce */}
          <polygon points="106,12 138,12 122,38" fill="#a855f7" stroke="#e9d5ff" strokeWidth="1.2" />
          <polygon points="90,38 122,38 106,64" fill="#9333ea" stroke="#e9d5ff" strokeWidth="1.2" />
          <polygon points="122,38 154,38 138,64" fill="#9333ea" stroke="#e9d5ff" strokeWidth="1.2" />
        </svg>

        <h1 className="font-display text-4xl sm:text-6xl font-extrabold tracking-wide text-[#fef3c7] drop-shadow-[0_4px_20px_rgba(0,0,0,0.85)] text-balance">
          A Link Between Worlds
        </h1>
        <p className="mt-3 text-sm sm:text-base text-slate-200/90 max-w-lg leading-relaxed">
          Merge onto stone walls as a living mural, cross shimmering fissures between Hyrule and Lorule, and claim the Pendant of Courage.
        </p>

        <button
          type="button"
          onClick={onStart}
          className="mt-8 px-9 py-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-semibold text-base tracking-wide shadow-[0_8px_28px_rgba(245,158,11,0.35)] transition-transform duration-150 cursor-pointer whitespace-nowrap"
        >
          Begin Quest
        </button>
      </div>

      <div className="text-xs sm:text-sm text-slate-300/85 tracking-wide text-center">
        WASD Move <span aria-hidden="true">·</span> Space / Click Sword <span aria-hidden="true">·</span> E Wall-Merge{' '}
        <span aria-hidden="true">·</span> 1-3 + F / Right-Click Items <span aria-hidden="true">·</span> Esc Pause
      </div>
    </div>
  );
};
