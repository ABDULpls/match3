import { describe, it, expect } from 'vitest';
import Match3GameService from '../src/gameService';

describe('AI helper', () => {
  it('findAnyValidSwap returns a move or null, and when present it is valid', () => {
    const s = new Match3GameService();
    s.initGame([1,2,3,4,5,6,1,2,3,4,5,6]);
    const move = s.findAnyValidSwap();
    if (move) {
      expect(s.willSwapCreateMatch(move.from, move.to)).toBe(true);
    } else {
      // In worst case, no move - but generally should exist
      expect(move).toBeNull();
    }
  });
});


