import { Container, Sprite, Ticker } from "pixi.js";

type BoardLike = any;

interface GridAddress {
  line: number;
  col: number;
}
const DEFAULT_UPDATE_SPEED = 3;
export default class Gem extends Container {
  private id: number;
  public type: number;
  private board: BoardLike;
  private updateSpeed = DEFAULT_UPDATE_SPEED;
  private readonly updateAcceleration = 1.1;
  private idName: string;
  private newPosition: Array<{ x: number; y: number }> = [];
  private myAddress: GridAddress = { line: 0, col: 0 };
  private gemObj: Sprite;

  constructor(type: number, id: number, board_: BoardLike, texture: any) {
    super();
    this.id = id;
    this.type = type;
    this.board = board_;
    this.idName = `gem${type}-${id}`;
    this.eventMode = 'dynamic';
    this.cursor = 'pointer';
    this.gemObj = new Sprite(texture);
    this.addChild(this.gemObj);
  }

  update(): boolean | { x: number; y: number } {
    if (this.newPosition.length > 0) {
      if (this.x < this.newPosition[0].x) {
        this.x = Math.min(this.x + this.updateSpeed, this.newPosition[0].x);
      } else if (this.x > this.newPosition[0].x) {
        this.x = Math.max(this.x - this.updateSpeed, this.newPosition[0].x);
      }
      if (this.y < this.newPosition[0].y) {
        this.y = Math.min(this.y + this.updateSpeed, this.newPosition[0].y);
      } else if (this.y > this.newPosition[0].y) {
        this.y = Math.max(this.y - this.updateSpeed, this.newPosition[0].y);
      }
      if (this.y === this.newPosition[0].y && this.x === this.newPosition[0].x) {
        return this.newPosition.shift() as { x: number; y: number };
      }
      this.updateSpeed *= this.updateAcceleration;
      return true;
    } else {
      this.updateSpeed = DEFAULT_UPDATE_SPEED;
      return false;
    }
  }

  addMovement(x_: number, y_: number, _reverse: boolean = false): void {
    this.newPosition.push({ x: x_, y: y_ });
  }

  insertExplosion(myAddress_: GridAddress): void {
    const gemTicker = new Ticker();
    gemTicker.add(this.animateExplosion(gemTicker, myAddress_));
    gemTicker.start();
  }

  animateExplosion(ticker: Ticker, myAddress_: GridAddress): () => void {
    return () => {
      this.alpha -= 0.03;
      if (this.alpha <= 0) {
        this.finishExplosion(myAddress_);
        ticker.destroy();
      }
    };
  }

  finishExplosion(myAddress_: GridAddress): void {
    setTimeout(() => {
      this.setAddress(myAddress_);
      this.board.endAnimation();
      this.board.removeGem(myAddress_);
      this.alpha = 1;
    }, 16);
  }

  setAddress(newAddress: GridAddress): void {
    this.myAddress = newAddress;
  }

  refresh(): void {
    // no-op placeholder
  }
}



