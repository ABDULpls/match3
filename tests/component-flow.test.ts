import { describe, it, expect } from 'vitest';
import Match3GameService, { EPlayer } from '../src/gameService';

// This is a service-level flow test approximating one human move then AI move.
describe('service-level flow', () => {
  it('applies human result and keeps game running, then applies AI result', () => {
    const s = new Match3GameService();
    const max = s.getMaxHP();
    const beforeHuman = s.getHP(EPlayer.Human);
    const beforeAI = s.getHP(EPlayer.AI);

    // Human completes a move causing damage and heal
    const r1 = s.applyMoveResult(EPlayer.Human, { damage: 7, heal: 2 });
    expect(r1.gameOver).toBe(false);
    expect(r1.hp[EPlayer.Human]).toBe(Math.min(max, beforeHuman + 2));
    expect(r1.hp[EPlayer.AI]).toBe(Math.max(0, beforeAI - 7));

    // AI completes a move causing some damage
    const r2 = s.applyMoveResult(EPlayer.AI, { damage: 3, heal: 1 });
    expect(r2.gameOver).toBe(false);
  });
});


