import { CONFIG } from './config';

export interface GridPos { line: number; col: number }
export enum EPlayer {
  Human,
  AI,
}
export interface SwapMove { from: GridPos; to: GridPos }
class Match3GameService {
  public options: Record<string, unknown>;
  private playersHP: Record<EPlayer, number> = {
    [EPlayer.Human]: Number(CONFIG.LEVEL.HP),
    [EPlayer.AI]: Number(CONFIG.LEVEL.HP),
  }
  public playersScore: Record<EPlayer, number> = {
    [EPlayer.Human]: 0,
    [EPlayer.AI]: 0,
  };
  public level: number[][];
  public rows: number;
  public cols: number;
  public board: number[][];
  public gameOver: boolean;
  public seed: number[];
  public readonly maxHP: number;

  constructor(options: Record<string, unknown> = {}) {
    this.options = { ...options };
    this.level = CONFIG.LEVEL.board;
    this.rows = (this.level as number[][]).length || 7;
    this.cols = (this.level as number[][])[0]?.length || 9;
    this.board = [];
    this.gameOver = false;
    this.seed = [];
    this.maxHP = Number(CONFIG.LEVEL.HP);
    this.initGame();
  }

  initGame(seed?: number[]): void {
    this.playersHP = {
      [EPlayer.Human]: Number(CONFIG.LEVEL.HP),
      [EPlayer.AI]: Number(CONFIG.LEVEL.HP),
    };
    this.playersScore = {
      [EPlayer.Human]: 0,
      [EPlayer.AI]: 0,
    };
    this.gameOver = false;
    this.seed = (seed && [...seed]) || this.generateSeed();
    this.board = this.createPlayableBoard();
  }

  generateSeed(): number[] {
    const seed: number[] = [];
    for (let i = 0; i < 1000; i++) {
      seed.push(Math.floor(Math.random() * 6) + 1);
    }
    return seed;
  }

  private createBoardNoInitialMatchesOnePass(seedStartIdx: number = 0): number[][] {
    const board: number[][] = [];
    let idx = seedStartIdx;
    for (let i = 0; i < this.rows; i++) {
      board[i] = [];
      for (let j = 0; j < this.cols; j++) {
        let gemType = this.seed[idx++ % this.seed.length];
        let maxloops = 100;
        while (
          (j >= 2 && board[i][j - 1] === gemType && board[i][j - 2] === gemType) ||
          (i >= 2 && board[i - 1][j] === gemType && board[i - 2][j] === gemType)
        ) {
          gemType = this.seed[idx++ % this.seed.length];
          if (--maxloops <= 0) break;
        }
        board[i][j] = gemType;
      }
    }
    return board;
  }

  /**
   * Ensure the generated board has at least one legal move and no initial matches.
   */
  private createPlayableBoard(): number[][] {
    // Try several offsets on seed to reshuffle deterministically if a seed is provided
    const maxAttempts = 200;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const seedOffset = attempt * 17; // step through seed positions to vary distribution
      const board = this.createBoardNoInitialMatchesOnePass(seedOffset);
      this.board = board;
      const hasMove = this.findAnyValidSwap() !== null;
      if (hasMove) {
        return board;
      }
    }
    // As a last resort, regenerate seed randomly until playable
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      this.seed = this.generateSeed();
      const board = this.createBoardNoInitialMatchesOnePass(0);
      this.board = board;
      if (this.findAnyValidSwap()) {
        return board;
      }
    }
    // Fallback: return a board anyway
    return this.createBoardNoInitialMatchesOnePass(0);
  }

  getBoard(): number[][] {
    return this.board;
  }

  /**
   * Simulate whether swapping two adjacent cells on the numeric board produces a match
   */
  willSwapCreateMatch(a: GridPos, b: GridPos): boolean {
    if (!this.isAdjacent(a, b)) return false;
    this.swap(a, b);
    const ok = this.hasMatchAt(a.line, a.col) || this.hasMatchAt(b.line, b.col);
    this.swap(a, b);
    return ok;
  }

  /**
   * Find any valid swap that would produce a match. Scans right and down neighbors to avoid duplicates.
   */
  findAnyValidSwap(): SwapMove | null {
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        const from: GridPos = { line: i, col: j };
        const rights: GridPos = { line: i, col: j + 1 };
        const downs: GridPos = { line: i + 1, col: j };
        if (rights.col < this.cols && this.willSwapCreateMatch(from, rights)) {
          return { from, to: rights };
        }
        if (downs.line < this.rows && this.willSwapCreateMatch(from, downs)) {
          return { from, to: downs };
        }
      }
    }
    return null;
  }

  swapGems(from: GridPos, to: GridPos, player: EPlayer): boolean {
    if (this.gameOver) {
      return false;
    }
    if (!this.isAdjacent(from, to)) {
      return false;
    }
    this.swap(from, to);
    // Validate that swap created a local match
    const fromMatch = this.collectMatchAt(from.line, from.col);
    const toMatch = this.collectMatchAt(to.line, to.col);
    const union: Record<string, GridPos> = {};
    for (const p of fromMatch) union[`${p.line},${p.col}`] = p;
    for (const p of toMatch) union[`${p.line},${p.col}`] = p;
    const matches = Object.values(union);
    if (matches.length === 0) {
      this.swap(from, to);
      return false;
    }
    this.resolveMatches(matches, player);
    return true;
  }

  private hasMatchAt(line: number, col: number): boolean {
    const val = this.board[line]?.[col];
    if (!val) return false;
    // horizontal count
    let count = 1;
    // left
    for (let c = col - 1; c >= 0 && this.board[line][c] === val; c--) count++;
    // right
    for (let c = col + 1; c < this.cols && this.board[line][c] === val; c++) count++;
    if (count >= 3) return true;

    // vertical count
    count = 1;
    // up
    for (let r = line - 1; r >= 0 && this.board[r][col] === val; r--) count++;
    // down
    for (let r = line + 1; r < this.rows && this.board[r][col] === val; r++) count++;
    return count >= 3;
  }

  private collectMatchAt(line: number, col: number): GridPos[] {
    const val = this.board[line]?.[col];
    if (!val) return [];
    const seen: Record<string, true> = {};
    const add = (r: number, c: number) => { seen[`${r},${c}`] = true; };

    // Horizontal run through (line, *)
    let run: GridPos[] = [{ line, col }];
    for (let c = col - 1; c >= 0 && this.board[line][c] === val; c--) run.push({ line, col: c });
    for (let c = col + 1; c < this.cols && this.board[line][c] === val; c++) run.push({ line, col: c });
    if (run.length >= 3) {
      for (const p of run) add(p.line, p.col);
    }

    // Vertical run through (*, col)
    run = [{ line, col }];
    for (let r = line - 1; r >= 0 && this.board[r][col] === val; r--) run.push({ line: r, col });
    for (let r = line + 1; r < this.rows && this.board[r][col] === val; r++) run.push({ line: r, col });
    if (run.length >= 3) {
      for (const p of run) add(p.line, p.col);
    }

    return Object.keys(seen).map(k => {
      const [r, c] = k.split(',').map(Number);
      return { line: r, col: c } as GridPos;
    });
  }

  explodeGems(addresses: GridPos[], playerId: EPlayer): void {
    if (this.gameOver) return;
    for (const addr of addresses) {
      if (this.board[addr.line][addr.col] !== 0) {
        this.addScore(this.board[addr.line][addr.col], playerId);
        this.board[addr.line][addr.col] = 0;
      }
    }
    this.dropGems();
    this.refillBoard();
    const matches = this.findAllMatches();
    if (matches.length > 0) {
      this.resolveMatches(matches, playerId);
    }
  }

  swap(a: GridPos, b: GridPos): void {
    const temp = this.board[a.line][a.col];
    this.board[a.line][a.col] = this.board[b.line][b.col];
    this.board[b.line][b.col] = temp;
  }

  isAdjacent(a: GridPos, b: GridPos): boolean {
    const dl = Math.abs(a.line - b.line);
    const dc = Math.abs(a.col - b.col);
    return (dl === 1 && dc === 0) || (dl === 0 && dc === 1);
  }

  findAllMatches(): GridPos[] {
    const seen: Record<string, true> = {};
    const result: GridPos[] = [];

    const add = (line: number, col: number) => {
      const key = `${line},${col}`;
      if (!seen[key]) {
        seen[key] = true;
        result.push({ line, col });
      }
    };

    // Horizontal runs
    for (let i = 0; i < this.rows; i++) {
      let streak = 1;
      for (let j = 1; j < this.cols; j++) {
        if (this.board[i][j] !== 0 && this.board[i][j] === this.board[i][j - 1]) {
          streak++;
        } else {
          if (streak >= 3) {
            for (let k = 0; k < streak; k++) {
              add(i, j - 1 - k);
            }
          }
          streak = 1;
        }
      }
      if (streak >= 3) {
        for (let k = 0; k < streak; k++) {
          add(i, this.cols - 1 - k);
        }
      }
    }

    // Vertical runs
    for (let j = 0; j < this.cols; j++) {
      let streak = 1;
      for (let i = 1; i < this.rows; i++) {
        if (this.board[i][j] !== 0 && this.board[i][j] === this.board[i - 1][j]) {
          streak++;
        } else {
          if (streak >= 3) {
            for (let k = 0; k < streak; k++) {
              add(i - 1 - k, j);
            }
          }
          streak = 1;
        }
      }
      if (streak >= 3) {
        for (let k = 0; k < streak; k++) {
          add(this.rows - 1 - k, j);
        }
      }
    }

    return result;
  }

  resolveMatches(matches: GridPos[], player: EPlayer): void {
    if (!matches || matches.length === 0) return;
    for (const pos of matches) {
      this.addScore(this.board[pos.line][pos.col], player);
      this.board[pos.line][pos.col] = 0;
    }
    this.dropGems();
    this.refillBoard();
    const newMatches = this.findAllMatches();
    if (newMatches.length > 0) {
      this.resolveMatches(newMatches, player);
    }
  }

  dropGems(): void {
    for (let col = 0; col < this.cols; col++) {
      for (let row = this.rows - 1; row >= 0; row--) {
        if (this.board[row][col] === 0) {
          for (let k = row - 1; k >= 0; k--) {
            if (this.board[k][col] !== 0) {
              this.board[row][col] = this.board[k][col];
              this.board[k][col] = 0;
              break;
            }
          }
        }
      }
    }
  }

  refillBoard(): void {
    let idx = 0;
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        if (this.board[i][j] === 0) {
          this.board[i][j] = this.seed[idx++ % this.seed.length];
        }
      }
    }
  }

  addScore(gemType: number, player: EPlayer): void {
    const score = this.convertTypeToScore(gemType);
    this.playersScore[player] += score;
  }

  convertTypeToScore(gemType: number): number {
    switch (gemType) {
      case 1:
        return 4;
      case 2:
        return 3;
      case 3:
        return 4;
      case 4:
        return 1;
      case 5:
        return 5;
      case 6:
        return 2;
      default:
        return 0;
    }
  }

  getScore(player: EPlayer): number {
    return this.playersScore[player];
  }

  getHP(player: EPlayer): number {
    return this.playersHP[player];
  }

  getMaxHP(): number {
    return this.maxHP;
  }

  applyMoveResult(player: EPlayer, result: { damage: number; heal: number }): { hp: Record<EPlayer, number>; gameOver: boolean } {
    if (this.gameOver) {
      return { hp: { [EPlayer.Human]: this.playersHP[EPlayer.Human], [EPlayer.AI]: this.playersHP[EPlayer.AI] }, gameOver: true };
    }
    const opponent = player === EPlayer.Human ? EPlayer.AI : EPlayer.Human;
    const damage = Math.max(0, Math.floor(result?.damage || 0));
    const heal = Math.max(0, Math.floor(result?.heal || 0));

    // Heal current player up to max
    this.playersHP[player] = Math.min(this.maxHP, this.playersHP[player] + heal);
    // Damage opponent down to zero
    this.playersHP[opponent] = Math.max(0, this.playersHP[opponent] - damage);

    this.playersScore[player] += damage + heal;

    // Check game over
    if (this.playersHP[player] <= 0 || this.playersHP[opponent] <= 0) {
      this.gameOver = true;
    }

    return {
      hp: {
        [EPlayer.Human]: this.playersHP[EPlayer.Human],
        [EPlayer.AI]: this.playersHP[EPlayer.AI],
      },
      gameOver: this.gameOver,
    };
  }

  isGameOver(): boolean {
    return this.gameOver;
  }
}

export default Match3GameService;



