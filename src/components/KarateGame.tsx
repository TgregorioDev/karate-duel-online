import { useRef, useEffect, useCallback, useState } from 'react';
import { createInitialState, updateGame, resetPositions } from '@/game/engine';
import { renderGame } from '@/game/renderer';
import { GameState, InputState, CANVAS_WIDTH, CANVAS_HEIGHT, FIGHT_DURATION } from '@/game/types';

export default function KarateGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState>(createInitialState());
  const inputRef = useRef<InputState>({ left: false, right: false, punch: false, kick: false, gyakuZuki: false, maeGeri: false, block: false });
  const animFrameRef = useRef<number>(0);
  const [, forceRender] = useState(0);

  const startGame = useCallback(() => {
    const gs = gameStateRef.current;
    if (gs.gameStatus === 'menu' || gs.gameStatus === 'game-over') {
      const fresh = createInitialState();
      fresh.gameStatus = 'fighting';
      fresh.judgeMessage = 'HAJIME!';
      fresh.judgeTimer = 60;
      gameStateRef.current = fresh;
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const inp = inputRef.current;
      switch (e.key.toLowerCase()) {
        case 'arrowleft': case 'a': inp.left = true; break;
        case 'arrowright': case 'd': inp.right = true; break;
        case 'z': case 'j': inp.punch = true; break;
        case 'x': case 'k': inp.kick = true; break;
        case 'v': case 'n': inp.gyakuZuki = true; break;
        case 'b': case 'm': inp.maeGeri = true; break;
        case 'c': case 'l': inp.block = true; break;
        case 'enter': case ' ':
          e.preventDefault();
          startGame();
          break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const inp = inputRef.current;
      switch (e.key.toLowerCase()) {
        case 'arrowleft': case 'a': inp.left = false; break;
        case 'arrowright': case 'd': inp.right = false; break;
        case 'z': case 'j': inp.punch = false; break;
        case 'x': case 'k': inp.kick = false; break;
        case 'v': case 'n': inp.gyakuZuki = false; break;
        case 'b': case 'm': inp.maeGeri = false; break;
        case 'c': case 'l': inp.block = false; break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [startGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / (1000 / 60), 2);
      lastTime = now;

      gameStateRef.current = updateGame(gameStateRef.current, inputRef.current, dt);

      // Reset one-shot inputs
      inputRef.current.punch = false;
      inputRef.current.kick = false;

      renderGame(ctx, gameStateRef.current);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 select-none">
      <h1 className="text-3xl font-bold text-glow-red tracking-widest" style={{ color: 'hsl(0, 72%, 51%)' }}>
        空手 KARATÊ
      </h1>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-2 rounded-lg shadow-2xl max-w-full"
        style={{
          borderColor: 'hsl(0, 72%, 30%)',
          imageRendering: 'auto',
        }}
        tabIndex={0}
      />
      <div className="flex gap-6 text-sm" style={{ color: 'hsl(40, 10%, 55%)' }}>
        <span>← → Mover</span>
        <span>Z Soco</span>
        <span>X Chute</span>
        <span>C Defesa</span>
      </div>
    </div>
  );
}
