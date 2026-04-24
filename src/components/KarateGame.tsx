import { useRef, useEffect, useCallback } from 'react';
import { createInitialState, updateGame, startBowIn } from '@/game/engine';
import { renderGame } from '@/game/renderer';
import { GameState, InputState, CANVAS_WIDTH, CANVAS_HEIGHT } from '@/game/types';

export default function KarateGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState>(createInitialState());
  const inputRef = useRef<InputState>({ left: false, right: false, punch: false, kick: false, gyakuZuki: false, maeGeri: false, block: false });
  const animFrameRef = useRef<number>(0);

  const startGame = useCallback(() => {
    const gs = gameStateRef.current;
    if (gs.gameStatus === 'menu' || gs.gameStatus === 'game-over') {
      const fresh = createInitialState();
      startBowIn(fresh);
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

      inputRef.current.punch = false;
      inputRef.current.kick = false;
      inputRef.current.gyakuZuki = false;
      inputRef.current.maeGeri = false;

      renderGame(ctx, gameStateRef.current);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 select-none">
      <h1 className="text-3xl font-bold tracking-widest text-glow-red" style={{ color: 'hsl(0, 72%, 51%)' }}>
        KARATE DUEL
      </h1>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="max-w-full rounded-lg border-2 shadow-2xl"
        style={{
          borderColor: 'hsl(0, 72%, 30%)',
          imageRendering: 'auto',
        }}
        tabIndex={0}
      />
      <div className="flex max-w-5xl flex-col items-center gap-2 text-xs" style={{ color: 'hsl(40, 10%, 55%)' }}>
        <div className="flex flex-wrap justify-center gap-4">
          <span>Left/Right ou A/D: mover</span>
          <span>Z: kizami-tsuki (yuko)</span>
          <span>V: gyaku-zuki (yuko)</span>
          <span>X: chute jodan (ippon)</span>
          <span>B: chute chudan (waza-ari)</span>
          <span>C: defesa</span>
        </div>
        <div className="flex flex-wrap justify-center gap-4 font-medium" style={{ color: 'hsl(45, 80%, 68%)' }}>
          <span>Yuko = 1</span>
          <span>Waza-ari = 2</span>
          <span>Ippon = 3</span>
          <span>Diferenca de 8 encerra a luta</span>
        </div>
      </div>
    </div>
  );
}
