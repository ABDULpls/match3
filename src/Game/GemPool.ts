import Gem from "./Gem";

type TextureLike = any;
type BoardLike = any;

export default class GemPool {
  public board: BoardLike;
  public gems: Record<number, Gem[]>;
  private gemTextures: TextureLike[];
  private nextId: Record<number, number>;

  constructor(board_: BoardLike, gemTextures: TextureLike[]) {
    this.board = board_;
    this.gemTextures = gemTextures;
    this.gems = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    this.nextId = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    for (let i = 0; i < 80; i++) {
      this.addGem(1, this.nextId[1]++, gemTextures[0]);
      this.addGem(2, this.nextId[2]++, gemTextures[1]);
      this.addGem(3, this.nextId[3]++, gemTextures[2]);
      this.addGem(4, this.nextId[4]++, gemTextures[3]);
      this.addGem(5, this.nextId[5]++, gemTextures[4]);
      this.addGem(6, this.nextId[6]++, gemTextures[5]);
    }
  }

  addGem(type: number, id: number, texture: TextureLike): void {
    const gem = new Gem(type, id, this.board, texture);
    this.gems[type].push(gem);
  }

  borrow(type: number): Gem {
    if (this.gems[type].length === 0) {
      // lazily expand pool for this type
      this.addGem(type, this.nextId[type]++, this.gemTextures[type - 1]);
    }
    return this.gems[type].shift() as Gem;
  }

  return(gem: Gem): void {
    this.gems[gem.type].push(gem);
  }
}



