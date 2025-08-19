import { describe, it, expect, beforeEach } from 'vitest';
import Match3GameService, { EPlayer } from '../src/gameService';

describe('Match3GameService core logic', () => {
  let service: Match3GameService;

  beforeEach(() => {
    service = new Match3GameService();
    // Make a deterministic small seed to simplify tests
    service.initGame([1,2,3,4,5,6,1,2,3,4,5,6]);
  });

  it('creates a board with no initial matches', () => {
    const board = service.getBoard();
    // spot check: no immediate 3-in-a-row horizontally or vertically
    const rows = board.length;
    const cols = board[0].length;
    const inBounds = (r:number,c:number)=> r>=0 && r<rows && c>=0 && c<cols;
    const hasTriple = () => {
      for (let r=0;r<rows;r++){
        for (let c=0;c<cols;c++){
          const v = board[r][c];
          if (!v) continue;
          if (inBounds(r,c+1) && inBounds(r,c+2) && board[r][c+1]===v && board[r][c+2]===v) return true;
          if (inBounds(r+1,c) && inBounds(r+2,c) && board[r+1][c]===v && board[r+2][c]===v) return true;
        }
      }
      return false;
    };
    expect(hasTriple()).toBe(false);
  });

  it('willSwapCreateMatch and findAnyValidSwap identify a legal move', () => {
    const move = service.findAnyValidSwap();
    expect(move === null).toBe(false);
    if (!move) return;
    expect(service.willSwapCreateMatch(move.from, move.to)).toBe(true);
  });

  it('swapGems resolves matches and refills board', () => {
    const move = service.findAnyValidSwap();
    expect(move).toBeTruthy();
    if (!move) return;
    const before = JSON.stringify(service.getBoard());
    const ok = service.swapGems(move.from, move.to, EPlayer.Human);
    expect(ok).toBe(true);
    const after = JSON.stringify(service.getBoard());
    expect(after).not.toEqual(before); // board changed due to resolves/refills
  });

  it('applyMoveResult affects HP correctly', () => {
    const max = service.getMaxHP();
    const humanHPBefore = service.getHP(EPlayer.Human);
    const aiHPBefore = service.getHP(EPlayer.AI);
    const { hp, gameOver } = service.applyMoveResult(EPlayer.Human, { damage: 5, heal: 3 });
    expect(gameOver).toBe(false);
    expect(hp[EPlayer.Human]).toBe(Math.min(max, humanHPBefore + 3));
    expect(hp[EPlayer.AI]).toBe(Math.max(0, aiHPBefore - 5));
  });
});


