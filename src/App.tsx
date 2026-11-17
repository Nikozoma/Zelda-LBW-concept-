import { useCallback, useEffect, useRef, useState } from 'react';
import { GameModals } from './components/GameModals';
import { HudOverlay } from './components/HudOverlay';
import { TitleScreen } from './components/TitleScreen';
import { TouchControls } from './components/TouchControls';
import { ALBWEngine } from './game/engine';
import { HudSnapshot, ItemId } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  phase: 'TITLE_MENU',
  world: 'hyrule',
  hp: 10,
  maxHp: 10,
  stamina: 100,
  maxStamina: 100,
  rupees: 0,
  keys: 0,
  unlockedItems: [],
  equippedItem: null,
  merged: false,
  canMergePrompt: false,
  nearSignText: null,
  bannerText: null,
  objectiveText: 'Pick up the Boomerang at Ravio’s Stall',
  muted: false,
  bossHp: null,
  bossMaxHp: null,
  bossName: null,
  stats: {
    enemiesDefeated: 0,
    fissuresCrossed: 0,
    timeSeconds: 0,
  },
};

function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    navigator.maxTouchPoints > 0 ||
    window.innerWidth <= 900
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ALBWEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [touchEnabled, setTouchEnabled] = useState<boolean>(detectTouchDevice);
  const userToggledTouchRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new ALBWEngine(canvas, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;
    engine.mount();

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)
      ) {
        e.preventDefault();
      }
      engine.handleKeyDown(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      engine.handleKeyUp(e.code);
    };

    const onBlur = () => {
      engine.handleBlur();
    };

    const onFirstTouch = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && !userToggledTouchRef.current) {
        setTouchEnabled(true);
      }
    };

    const onResize = () => {
      if (!userToggledTouchRef.current) {
        setTouchEnabled(detectTouchDevice());
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pointerdown', onFirstTouch, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pointerdown', onFirstTouch);
      window.removeEventListener('resize', onResize);
      engine.unmount();
      engineRef.current = null;
    };
  }, []);

  const handleStart = useCallback(() => {
    engineRef.current?.startGame();
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.setPhase('PLAYING');
  }, []);

  const handleRestart = useCallback(() => {
    engineRef.current?.startGame();
  }, []);

  const handleSelectItem = useCallback((item: ItemId) => {
    engineRef.current?.selectItem(item);
  }, []);

  const handleToggleMute = useCallback(() => {
    engineRef.current?.toggleMute();
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.togglePause();
  }, []);

  const handleToggleTouch = useCallback(() => {
    userToggledTouchRef.current = true;
    setTouchEnabled((prev) => {
      if (prev) engineRef.current?.setTouchMove(0, 0);
      return !prev;
    });
  }, []);

  const handleTouchMove = useCallback((x: number, y: number) => {
    engineRef.current?.setTouchMove(x, y);
  }, []);

  const handleTouchAction = useCallback((action: 'sword' | 'merge' | 'item' | 'cycle') => {
    engineRef.current?.triggerTouchAction(action);
  }, []);

  return (
    <main className="relative w-screen h-dvh overflow-hidden bg-[#090d16] touch-none">
      {/* Isolated Full-Viewport Game Canvas */}
      <div className="absolute inset-0">
        <canvas
          ref={canvasRef}
          className="block w-full h-full cursor-crosshair touch-none"
          onPointerDown={(e) => {
            if (e.pointerType === 'mouse') {
              engineRef.current?.handleCanvasClick(e.button);
            }
          }}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {/* Title Screen */}
      {hud.phase === 'TITLE_MENU' && <TitleScreen onStart={handleStart} />}

      {/* Active Play HUD */}
      {hud.phase !== 'TITLE_MENU' && (
        <HudOverlay
          hud={hud}
          touchEnabled={touchEnabled}
          onSelectItem={handleSelectItem}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
        />
      )}

      {/* Smartphone Multi-Touch Controls */}
      {hud.phase === 'PLAYING' && touchEnabled && (
        <TouchControls
          hud={hud}
          onMove={handleTouchMove}
          onAction={handleTouchAction}
        />
      )}

      {/* Pause / Victory / Game Over Modals */}
      <GameModals
        hud={hud}
        touchEnabled={touchEnabled}
        onToggleTouch={handleToggleTouch}
        onResume={handleResume}
        onRestart={handleRestart}
      />
    </main>
  );
}
