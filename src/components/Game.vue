<template>
  <div>
    <div class="game" ref="game" id="game" :style="{/*height: '100%', width: `${this.gameWidth}px`*/}">
    </div>
  </div>
</template>

<script lang="ts">
// import GameLoader from "./Loader";
import * as PIXI from "pixi.js";
// Use built-in BitmapText/BitmapFont from pixi.js v8
import GemPool from "../Game/GemPool";
import {CONFIG} from "../config";
// Filters removed or to be re-added with v8-compatible packages if needed
import _debounce from "lodash/debounce";
import {sound} from "@pixi/sound";
import Match3GameService, {EPlayer} from "../gameService";


// Removed skipHello for Pixi v8

export default {
  name: "Match3",

  components: {
    // GameLoader
  },

  async created() {
    this.loadVolumeFromStorage();
    this.init();
    this.addGemsToBoard = _debounce(this.addGemsToBoard, 30, {
      leading: false,
      trailing: true
    });
  },

  data: function () {
    return {
      app: null,
      interactive: true, // Single player is always interactive
      gameService: null as Match3GameService, // Will hold the Match3GameService instance
      volume: true, // Volume state - will be loaded from localStorage
      level: CONFIG.LEVEL,
      maxHP: 0,
      player1HPValue: 0,
      player2HPValue: 0,
      gemSprites: [],
      dynamiteSprite: null,
      tntSprite: null,
      dynamiteAvailable: false,
      tntAvailable: false,
      draggingDynamite: false,
      draggingTnt: false,
      draggingData: null,
      inactiveColor: 0x272735,
      activeColor: 0xffd828,
      gemsToInsert: [],
      makingMove: false,
      gemPool: null,
      seed: [],
      previousGemType: 0,
      currentDamage: 0,
      currentHeal: 0,
      gemContainer: null,
      gemsMap: [] as number[][],
      gemsPopped: false,
      eventIsDown: false,
      rightOutline: null,
      leftOutline: null,
      eventStartPoint: {
        x: 0,
        y: 0
      },
      gemsAreMoving: false,
      gemsSwapping: [],
      gemSelected: null,
      hasAnimation: false,
      gameWidth: CONFIG.BOARD.MAX_WIDTH,
      logicalWidth: CONFIG.BOARD.MAX_WIDTH,
      logicalHeight: CONFIG.BOARD.MAX_HEIGHT,
      newWidth: CONFIG.BOARD.MAX_WIDTH,
      newHeight: CONFIG.BOARD.MAX_HEIGHT,
      // Player vs AI data
      player1HP: CONFIG.LEVEL.HP,
      player2HP: CONFIG.LEVEL.HP,
      player1Score: 0,
      player2Score: 0,
      gameOver: false,
      robotId: 2, // AI player ID
      avatarSprites: [],
      avatarContainer: null,
      player: null,
      userId: {},
      moverId: null,
      currentPlayer: EPlayer.Human,
      view: {
        paddingX: 0,
        paddingY: 0,
        boardWidth: 0,
        boardHeight: 0,
        scoreSize: 0
      },
    };
  },

  computed: {
    currentRound() {
      return this.round;
    },
  },
  methods: {
    updateTextSprite(sprite, text, fontSize = 18, color = '#FFFFFF') {
      if (!sprite) {
        return;
      }
      const padX = 8;
      const padY = 4;
      const font = `${fontSize}px Arial`;
      const measureCtx = document.createElement('canvas').getContext('2d');
      measureCtx.font = font;
      const metrics = measureCtx.measureText(text);
      const width = Math.ceil(metrics.width) + padX * 2;
      const height = Math.ceil(fontSize * 1.4) + padY * 2;
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const ctx = c.getContext('2d');
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textBaseline = 'top';
      ctx.clearRect(0, 0, width, height);
      ctx.fillText(text, padX, padY);
      sprite.texture = PIXI.Texture.from(c);
    },
    refreshHPBars() {
      if (!this.player1HPBar || !this.player2HPBar || !this.avatarContainer) {
        return;
      }
      this.player1HPBar.clear();
      this.player1HPBar = new PIXI.Graphics()
          .rect(85, 40, (this.player1HPValue * 150) / this.maxHP, 20)
          .fill(0xFFFFFF);
      this.player1HPBar.tint = this.player1HPValue / this.maxHP > 0.30 ? 0x0ec468 : 0xDD4A2A;
      this.player1HPBar.zIndex = -1;
      this.avatarContainer.addChild(this.player1HPBar);

      this.player2HPBar.clear();
      this.player2HPBar = new PIXI.Graphics()
          .rect(CONFIG.BOARD.MAX_WIDTH - 90, 40, (this.player2HPValue * 150) / this.maxHP, 20)
          .fill(0xFFFFFF);
      this.player2HPBar.tint = this.player2HPValue / this.maxHP > 0.30 ? 0x0ec468 : 0xDD4A2A;
      this.player2HPBar.zIndex = -1;
      this.player2HPBar.pivot.set(+this.player2HPBar.width, 0);
      this.avatarContainer.addChild(this.player2HPBar);

      this.updateTextSprite(this.player1HP, `${this.player1HPValue} HP`, 18, '#FFFFFF');
      this.updateTextSprite(this.player2HP, `${this.player2HPValue} HP`, 18, '#FFFFFF');
    },
    createTextSprite(text, fontSize = 18, color = '#FFFFFF') {
      const padX = 8;
      const padY = 4;
      const font = `${fontSize}px Arial`;
      const measureCtx = document.createElement('canvas').getContext('2d');
      measureCtx.font = font;
      const metrics = measureCtx.measureText(text);
      const width = Math.ceil(metrics.width) + padX * 2;
      const height = Math.ceil(fontSize * 1.4) + padY * 2;
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const ctx = c.getContext('2d');
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textBaseline = 'top';
      ctx.fillText(text, padX, padY);
      const texture = PIXI.Texture.from(c);
      return new PIXI.Sprite(texture);
    },
    resizeHandler() {
      if (!this.app || !this.app.renderer || !this.$refs.game) return;
      const targetW = this.$refs.game.clientWidth;
      const targetH = this.$refs.game.clientHeight;
      const scaleFactor = Math.min(targetW / this.logicalWidth, targetH / this.logicalHeight);
      if (targetW < this.logicalWidth) {
        this.newWidth = targetW;
        this.newHeight = this.newWidth * 1.094;
      } else {
        this.newWidth = this.logicalWidth;
        this.newHeight = this.logicalHeight;
      }
      this.app.renderer.canvas.style.width = `${this.newWidth}px`;
      this.app.renderer.canvas.style.height = `${this.newHeight}px`;
      this.app.renderer.resize(this.newWidth, this.newHeight);
    },
    init() {
      this.resetState();
      sound.add('explosion', './src/assets/explosion.mp3');
      sound.add('gemMovement', './src/assets/jeweldrop.mp3');
      this.initGameService();
      this.initGame(); // Start the game immediately
    },

    initGameService() {
      this.gameService = new Match3GameService();
      // Initialize both players' HP and scores
      this.maxHP = this.gameService.getMaxHP();
      this.player1HPValue = this.gameService.getHP(EPlayer.Human);
      this.player2HPValue = this.gameService.getHP(EPlayer.AI);
      this.player1Score = 0;
      this.player2Score = 0;
      this.gameOver = this.gameService.isGameOver();
      this.interactive = true;
    },
    loadVolumeFromStorage() {
      const savedVolume = localStorage.getItem('match3_volume');
      if (savedVolume !== null) {
        this.volume = JSON.parse(savedVolume);
      }
    },
    onMoverChange(userId, player1HP, player2HP, /*lastRefreshId*/) {
      this.currentPlayer = +userId;
      this.currentDamage = 0;
      this.currentHeal = 0;
      if (this.player1HP && this.player2HP) {
        this.player1HPBar.clear();
        this.player1HPBar = new PIXI.Graphics()
            .rect(85, 40, player1HP * 150 / this.maxHP, 20)
            .fill(0xFFFFFF);
        if (player1HP / this.maxHP > 0.30)
          this.player1HPBar.tint = 0x0ec468;
        else
          this.player1HPBar.tint = 0xDD4A2A;
        this.player1HPBar.zIndex = -1;
        this.avatarContainer.addChild(this.player1HPBar);

        this.player2HPBar.clear();
        this.player2HPBar = new PIXI.Graphics()
            .rect(CONFIG.BOARD.MAX_WIDTH - 90, 40, player2HP * 150 / this.maxHP, 20)
            .fill(0xFFFFFF);
        if (player2HP / this.maxHP > 0.30)
          this.player2HPBar.tint = 0x0ec468;
        else
          this.player2HPBar.tint = 0xDD4A2A;
        this.player2HPBar.zIndex = -1;
        this.player2HPBar.pivot.set(+this.player2HPBar.width, 0);
        this.avatarContainer.addChild(this.player2HPBar);
        this.player1HP.text = player1HP + ' HP';
        this.player2HP.text = player2HP + ' HP';
      }
      this.interactive = this.currentPlayer === EPlayer.Human;
      if (EPlayer.AI === this.currentPlayer) {
        this.robotPlay();
      }
    },

    toggleVolume() {
      this.volume = !this.volume;
      this.saveVolumeToStorage();
    },

    // Bot/AI logic for single player vs AI
    robotPlay() {
      if (this.gameOver || this.currentPlayer !== EPlayer.AI) {
        return;
      }
      // Prefer service-provided valid swap if available
      const serviceMove = this.gameService.findAnyValidSwap();
      if (serviceMove) {
        const from = serviceMove.from;
        const to = serviceMove.to;
        if (this.willSwapCreateMatch(from, to)) {
          this.insertGemSwap(from, {line: to.line - from.line, col: to.col - from.col}, true);
          return;
        }
      }

      // Fallback: scan current UI board for any valid swap
      const rows = this.gemsMap.length;
      const cols = this.gemsMap[0].length;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const from = {line: r, col: c};
          const candidates = [
            {line: r - 1, col: c},
            {line: r + 1, col: c},
            {line: r, col: c - 1},
            {line: r, col: c + 1},
          ];
          for (let i = 0; i < candidates.length; i++) {
            const to = candidates[i];
            if (to.line >= 0 && to.line < rows && to.col >= 0 && to.col < cols) {
              if (this.willSwapCreateMatch(from, to)) {
                this.insertGemSwap(from, {line: to.line - from.line, col: to.col - from.col}, true);
                return;
              }
            }
          }
        }
      }

      // No valid move found; end AI turn without action
      this.onRobotMoveComplete();
    },

    willSwapCreateMatch(from, to) {
      const isWithinBoard = (row, col) => row >= 0 && row < this.gemsMap.length && col >= 0 && col < this.gemsMap[0].length;
      if (!isWithinBoard(from.line, from.col) || !isWithinBoard(to.line, to.col)) {
        return false;
      }
      const a = this.gemsMap[from.line][from.col];
      const b = this.gemsMap[to.line][to.col];
      if (a === -1 || b === -1) {
        return false;
      }
      // swap types hypothetically
      const typeA = a.type;
      const typeB = b.type;
      // helper to count in a direction
      const countLine = (row, col, directionRow, directionCol, type) => {
        let count = 0;
        let nextRow = row + directionRow;
        let nextCol = col + directionCol;
        while (isWithinBoard(nextRow, nextCol) && this.gemsMap[nextRow][nextCol] !== -1 && this.gemsMap[nextRow][nextCol].type === type) {
          count++;
          nextRow += directionRow;
          nextCol += directionCol;
        }
        return count;
      };
      const checkPos = (row, col, type) => {
        const horiz = 1 + countLine(row, col, 0, -1, type) + countLine(row, col, 0, 1, type);
        if (horiz >= 3) return true;
        const vert = 1 + countLine(row, col, -1, 0, type) + countLine(row, col, 1, 0, type);
        return vert >= 3;
      };
      // check after swap
      return checkPos(from.line, from.col, typeB) || checkPos(to.line, to.col, typeA);
    },

    onRobotMoveComplete() {
      if (this.currentPlayer === EPlayer.AI) {
        this.currentPlayer = EPlayer.Human;
      }
      this.interactive = true;
      if (this.leftOutline && this.rightOutline) {
        this.leftOutline.tint = this.activeColor;
        this.rightOutline.tint = this.inactiveColor;
      }
    },

    initGame() {
      this.resetState();
      this.startGame();
    },

    async startGame() {
      this.playerAvatars = {
        [EPlayer.Human]: {
          id: 1,
          img: 'src/assets/player1.png',
          name: 'Player'
        },
        [EPlayer.AI]: {
          id: 2,
          img: 'src/assets/player2.png',
          name: 'AI'
        }
      };
      this.playerIds = [1, 2];
      const manifest = {
        bundles: [
          {
            name: 'main',
            assets: {
              sprites: 'src/assets/sprites.json',
              player1: 'src/assets/player1.png',
              player2: 'src/assets/player2.png',
              back: 'src/assets/back.jpg'
            }
          }
        ]
      };
      await PIXI.Assets.init({manifest});
      const resources = await PIXI.Assets.loadBundle('main');
      this.$refs.game.innerHTML = null;
      this.app = new PIXI.Application();
      await this.app.init({
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        backgroundAlpha: 0,
        powerPreference: 'high-performance',
        background: CONFIG.BACKGROUND_COLOR,
      });
      this.$refs.game.appendChild(this.app.canvas);
      this.app.stage.sortableChildren = true;
      this.app.renderer.canvas.style.touchAction = "none";
      this.app.renderer.resize(this.logicalWidth, this.logicalHeight);
      this.playField = new PIXI.Container();
      this.playField.sortableChildren = true;
      this.playField.zIndex = 0;
      this.app.stage.addChild(this.playField);

      let gemTextures = [];
      const sheet = resources.sprites;
      const textures = sheet.textures ?? sheet;
      for (let key of Object.keys(textures)) {
        gemTextures.push(textures[key]);
      }
      this.gemPool = new GemPool(this, gemTextures);
      this.gemContainer = new PIXI.Container();
      this.gemContainer.zIndex = 0;
      this.gemContainer.y += 90;
      this.gemContainer.x += 8;
      this.playField.y += 90;
      this.playField.x += 8;
      this.app.stage.addChild(this.gemContainer);
      this.gemContainer.eventMode = this.interactive ? 'static' : 'none';
      this.gemContainer.cursor = this.interactive ? 'pointer' : 'default';
      this.gemContainer.on("pointerdown", this.pointerdown);
      this.gemContainer.on("pointermove", this.pointermove);
      this.gemContainer.on("pointerup", this.pointerup);
      this.gemContainer.sortableChildren = true;


      this.dynamiteSprite = new PIXI.Sprite(gemTextures[6]);
      this.tntSprite = new PIXI.Sprite(gemTextures[7]);
      this.app.stage.addChild(this.dynamiteSprite);
      this.app.stage.addChild(this.tntSprite);
      this.tntSprite.anchor.set(0.5);
      this.dynamiteSprite.anchor.set(0.5);
      this.tntSprite.position.set(145, this.logicalHeight - 60);
      this.dynamiteSprite.position.set(45, this.logicalHeight - 60);

      this.dynamiteSprite.alpha = 0.5;
      this.tntSprite.alpha = 0.5;
      this.dynamiteSprite.eventMode = 'none';
      this.tntSprite.eventMode = 'none';


      this.dynamiteSprite
          // events for drag start
          .on('pointerdown', this.onDynamiteDragStart)
          .on('touchstart', this.onDynamiteDragStart)
          // events for drag end
          .on('pointerup', this.onDynamiteDragEnd)
          .on('pointerupoutside', this.onDynamiteDragEnd)
          .on('touchend', this.onDynamiteDragEnd)
          .on('touchendoutside', this.onDynamiteDragEnd)
          // events for drag move
          .on('pointermove', this.onDynamiteDragMove)
          .on('touchmove', this.onDynamiteDragMove);
      this.tntSprite
          // events for drag start
          .on('pointerdown', this.onTntDragStart)
          .on('touchstart', this.onTntDragStart)
          // events for drag end
          .on('pointerup', this.onTntDragEnd)
          .on('pointerupoutside', this.onTntDragEnd)
          .on('touchend', this.onTntDragEnd)
          .on('touchendoutside', this.onTntDragEnd)
          // events for drag move
          .on('pointermove', this.onTntDragMove)
          .on('touchmove', this.onTntDragMove);

      this.redraw();
      this.app.ticker.maxFPS = 60;

      this.populate();

      this.app.ticker.add(this.update);
      this.drawPlayers(resources.player1, resources.player2);
      this.drawBackground(resources.back);
      this.drawReference(gemTextures);
      this.drawGemsBackground();
      this.resizeHandler();
      this.updateCanvasHitArea();
    },
    drawBackground(texture: PIXI.Texture) {
      // unused back texture, looks bad
      const c = document.createElement('canvas');
      c.width = this.logicalWidth;
      c.height = this.logicalHeight;
      const ctx = c.getContext('2d');
      const grd = ctx.createLinearGradient(0, 0, this.logicalWidth / 2, this.logicalHeight / 2);
      grd.addColorStop(0, '#48487b');
      grd.addColorStop(1, '#48487b');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
      const background = new PIXI.Sprite(PIXI.Texture.from(c));
      background.x = 0;
      background.y = 0;
      background.zIndex = -7;
      this.app.stage.addChild(background);
    },
    drawReference(textures: PIXI.Texture[]) {
      let refGems = [];
      for (let i = 0; i < 6; i++) {
        refGems.push(new PIXI.Sprite(textures[i]));
        this.app.stage.addChild(refGems[i]);
        refGems[i].scale.set(0.42);
      }
      refGems[4].position.set(220, this.logicalHeight - 70);
      refGems[0].position.set(220 + 55, this.logicalHeight - 70);
      refGems[1].position.set(220 + 55 * 2, this.logicalHeight - 70);
      refGems[5].position.set(220 + 55 * 3, this.logicalHeight - 70);
      refGems[3].position.set(220 + 55 * 4, this.logicalHeight - 70);
      refGems[2].position.set(220 + 55 * 5, this.logicalHeight - 70);
      const background = new PIXI.Graphics()
          .roundRect(210, this.logicalHeight - 85, 344, 60, 50)
          .fill(0x272735);
      background.zIndex = -5;
      this.app.stage.addChild(background);
      const explosivesBackground = new PIXI.Graphics()
          .circle(45, this.logicalHeight - 55, 41)
          .circle(140, this.logicalHeight - 55, 41)
          .fill(0x272735);
      explosivesBackground.zIndex = -5;
      this.app.stage.addChild(explosivesBackground);
      const gemValue = new PIXI.BitmapText(`-5      -4       -3      -2      -1      +4`,
          {
            fontName: "TitleFont",
            fontSize: 21,
            align: "right"
          });
      this.app.stage.addChild(gemValue);
      gemValue.position.set(248, this.logicalHeight - 68);
    },
    drawGemsBackground() {
      for (let i = 0; i < this.level.board.length; i++) {
        for (let j = 0; j < this.level.board[0].length; j++) {
          const background = new PIXI.Graphics();
          background.rect(j * 61, i * 61, 60, 60).fill(0x141319);
          background.alpha = 0.4;
          background.zIndex = -6;
          this.playField.addChild(background);
        }
      }
      for (let i = 0; i < this.level.board.length + 1; i++) {
        const outline = new PIXI.Graphics();
        outline.setStrokeStyle({width: 1, color: 0xb29067});
        outline.moveTo(0, i * 61).lineTo((this.level.board[0].length) * 61, i * 61);
        outline.zIndex = -5;
        this.gemContainer.addChild(outline);
      }
      for (let i = 0; i < this.level.board[0].length + 1; i++) {
        const outline = new PIXI.Graphics();
        outline.setStrokeStyle({width: 1, color: 0xb29067});
        outline.moveTo(i * 61, 0).lineTo(i * 61, (this.level.board.length) * 61);
        outline.zIndex = -5;
        this.gemContainer.addChild(outline);
      }
    },
    onDynamiteDragStart(e) {
      this.draggingDynamite = true;
    },
    onTntDragStart(e) {
      this.draggingTnt = true;
    },
    onDynamiteDragEnd() {
      this.draggingDynamite = false;
      if (this.dragCell && this.dragCell.row != null && this.dragCell.col != null) {
        const line = this.dragCell.row;
        const col = this.dragCell.col;

        const gemsToExplode = [
          {
            line: line,
            col: col
          },
        ];
        if (this.dragCell.row - 1 >= 0) {
          gemsToExplode.push({
            line: this.dragCell.row - 1,
            col: this.dragCell.col
          });
        }
        if (this.dragCell.row + 1 <= 6) {
          gemsToExplode.push({
            line: this.dragCell.row + 1,
            col: this.dragCell.col
          });
        }
        if (this.dragCell.col - 1 >= 0) {
          gemsToExplode.push({
            line: this.dragCell.row,
            col: this.dragCell.col - 1
          });
        }
        if (this.dragCell.col + 1 <= 8) {
          gemsToExplode.push({
            line: this.dragCell.row,
            col: this.dragCell.col + 1
          });
        }
        this.setDynamiteAvailability(false);
        this.explodeGems(gemsToExplode);
        // this.$socket.emit('playTile', this.player.userId, gemsToExplode, 'explosion');
        if (this.volume) {
          sound.play('explosion');
        }
      }
      for (let i = 0; i < this.playField.children.length; i++) {
        this.playField.children[i].alpha = 0.4;
      }
      this.dynamiteSprite.position.set(45, this.logicalHeight - 60);

      this.dragCell = null;
    },
    setDynamiteAvailability(available: boolean) {
      this.dynamiteAvailable = available;
      this.dynamiteSprite.alpha = available ? 1 : 0.5;
      this.dynamiteSprite.buttonMode = available;
      this.dynamiteSprite.interactive = available;
      this.dynamiteSprite.eventMode = available ? 'static' : 'none';
      this.dynamiteSprite.cursor = available ? 'pointer' : 'default';
    },
    onTntDragEnd() {
      this.draggingTnt = false;

      if (this.dragCell && this.dragCell.row != null && this.dragCell.col != null) {

        const gemsToExplode = [{
          line: this.dragCell.row,
          col: this.dragCell.col
        }];
        //scuffed
        if (this.dragCell.row - 1 >= 0) {
          gemsToExplode.push({
            line: this.dragCell.row + 1,
            col: this.dragCell.col
          });
        }
        if (this.dragCell.row + 1 <= 6) {
          gemsToExplode.push({
            line: this.dragCell.row + 1,
            col: this.dragCell.col
          });
        }
        if (this.dragCell.col - 1 >= 0) {
          gemsToExplode.push({
            line: this.dragCell.row,
            col: this.dragCell.col - 1
          });
        }
        if (this.dragCell.col + 1 <= 8) {
          gemsToExplode.push({
            line: this.dragCell.row,
            col: this.dragCell.col + 1
          });
        }
        if (this.dragCell.col + 1 <= 8 && this.dragCell.row + 1 <= 6) {
          gemsToExplode.push({
            line: this.dragCell.row + 1,
            col: this.dragCell.col + 1
          });
        }
        //scuffed
        if (this.dragCell.col + 1 <= 8 && this.dragCell.row - 1 >= 0) {
          gemsToExplode.push({
            line: this.dragCell.row + 1,
            col: this.dragCell.col + 1
          });
        }
        if (this.dragCell.col - 1 >= 0 && this.dragCell.row + 1 <= 6) {
          gemsToExplode.push({
            line: this.dragCell.row + 1,
            col: this.dragCell.col - 1
          });
        }
        // scuffed
        if (this.dragCell.col - 1 >= 0 && this.dragCell.row - 1 >= 0) {
          gemsToExplode.push({
            line: this.dragCell.row + 1,
            col: this.dragCell.col - 1
          });
        }
        this.explodeGems(gemsToExplode);
        this.tntAvailable = false;
        this.tntAvailable = false;
        this.tntSprite.alpha = 0.5;
        this.tntSprite.buttonMode = false;
        this.tntSprite.interactive = false;
        // this.tntAvailability(false)
        // this.$socket.emit('playTile', this.player.userId, gemsToExplode, 'explosion');
        if (this.volume) {
          sound.play('explosion');
        }
      }
      this.dragCell = null;
      for (let i = 0; i < this.playField.children.length; i++) {
        this.playField.children[i].alpha = 0.4;
      }
      this.tntSprite.position.set(145, this.logicalHeight - 60);

    },
    explodeGems(gemsToExplode) {
      this.hasAnimation = true;
      this.gemsAreMoving = true;

      // Accumulate damage/heal for TNT/dynamite explosions (to be applied at end of cascades)
      for (let i = 0; i < gemsToExplode.length; i++) {
        const coords = gemsToExplode[i];
        const line = coords.line;
        const col = coords.col;
        if (this.gemsMap[line] && this.gemsMap[line][col] && this.gemsMap[line][col] !== -1) {
          this.addScore(this.gemsMap[line][col].type);
        }
      }

      // Update UI
      for (let i = 0; i < gemsToExplode.length; i++) {
        let gemAddress = gemsToExplode[i];
        if (this.gemsMap[gemAddress.line] && this.gemsMap[gemAddress.line][gemAddress.col]) {
          this.gemsMap[gemAddress.line][gemAddress.col].insertExplosion(gemAddress);
        }
      }

      this.gemsPopped = true;

      // Defer applying score/HP and turn switch until cascades finish
    },
    onDynamiteDragMove(e) {
      if (this.draggingDynamite) {
        const newPosition = e.getLocalPosition(this.app.stage);
        const col = Math.ceil((newPosition.x - 9) / 61) - 1;
        const row = Math.ceil((newPosition.y - 27) / 61) - 2;
        this.dynamiteSprite.position.x = newPosition.x;
        this.dynamiteSprite.position.y = newPosition.y;
        for (let i = 0; i < this.playField.children.length; i++) {
          this.playField.children[i].alpha = 0.4;
          this.playField.children[i].zIndex = -6;
        }
        if (col >= 0 && col <= 8 && row >= 0 && row <= 6) {
          this.dragCell = {col, row};
          const cells = this.playField.children;
          if (cells[row * 9 + col]) {
            cells[row * 9 + col].alpha = 0.9;
            // cells[row * 9 + col].zIndex = 1
          }
          if (cells[row * 9 + col - 1] && col > 0) {
            cells[row * 9 + col - 1].alpha = 0.9;
            // cells[row * 9 + col - 1].zIndex = 2

          }
          if (cells[row * 9 + col + 1] && col < 8) {
            cells[row * 9 + col + 1].alpha = 0.9;
            // cells[row * 9 + col + 1].zIndex = 2

          }
          if (cells[(row - 1) * 9 + col]) {
            cells[(row - 1) * 9 + col].alpha = 0.9;
            // cells[(row - 1) * 9 + col].zIndex = 2
          }
          if (cells[(row + 1) * 9 + col]) {
            cells[(row + 1) * 9 + col].alpha = 0.9;
            // cells[(row + 1) * 9 + col].zIndex = 2

          }
        } else {
          this.dragCell = null;
        }
      }
    },
    onTntDragMove(e) {
      if (this.draggingTnt) {
        const newPosition = e.getLocalPosition(this.app.stage);
        const col = Math.ceil((newPosition.x - 9) / 61) - 1;
        const row = Math.ceil((newPosition.y - 27) / 61) - 2;
        this.tntSprite.position.x = newPosition.x;
        this.tntSprite.position.y = newPosition.y;
        for (let i = 0; i < this.playField.children.length; i++) {
          this.playField.children[i].alpha = 0.4;
        }
        if (col >= 0 && col <= 8 && row >= 0 && row <= 6) {
          this.dragCell = {col, row};
          const cells = this.playField.children;
          if (cells[row * 9 + col])
            cells[row * 9 + col].alpha = 0.9;
          if (cells[row * 9 + col - 1] && col > 0)
            cells[row * 9 + col - 1].alpha = 0.9;
          if (cells[row * 9 + col + 1] && col < 8)
            cells[row * 9 + col + 1].alpha = 0.9;
          if (cells[(row - 1) * 9 + col])
            cells[(row - 1) * 9 + col].alpha = 0.9;
          if (cells[(row + 1) * 9 + col])
            cells[(row + 1) * 9 + col].alpha = 0.9;
          if (cells[(row + 1) * 9 + col + 1] && col < 8)
            cells[(row + 1) * 9 + col + 1].alpha = 0.9;
          if (cells[(row + 1) * 9 + col - 1] && col > 0)
            cells[(row + 1) * 9 + col - 1].alpha = 0.9;
          if (cells[(row - 1) * 9 + col - 1] && col > 0)
            cells[(row - 1) * 9 + col - 1].alpha = 0.9;
          if (cells[(row - 1) * 9 + col + 1] && col < 8)
            cells[(row - 1) * 9 + col + 1].alpha = 0.9;
        } else {
          this.dragCell = null;
        }
        //tnt explodes 0 1 when out of bounds
      }
    },

    update(a) {
      let gemmap = this.gemsMap;
      let hasGemMovement = false;
      for (let line = gemmap.length - 1; line >= 0; line--) {
        for (let col = gemmap[line].length - 1; col >= 0; col--) {
          if (gemmap[line][col] !== -1 && gemmap[line][col].update()) {
            hasGemMovement = true;
          }
        }
      }

      if (!this.hasAnimation && hasGemMovement === false && this.gemsAreMoving) {
        if (!this.checkAndInsertMatch3()) {
          this.reverseGemsSwap();
        }
        this.finishGemsSwap();
      }

    },
    drawPlayers(player1Texture: PIXI.Texture, player2Texture: PIXI.Texture) {
      this.avatarContainer = new PIXI.Container;
      this.avatarContainer.sortableChildren = true;
      this.avatarContainer.zIndex = 6;
      this.avatarContainer.height = 150;
      this.app.stage.addChild(this.avatarContainer);

      const base = new PIXI.Graphics()
          .rect(0, 0, this.logicalWidth, 89)
          .fill(0x48487b);
      base.zIndex = -3;
      this.avatarContainer.addChild(base);
        this.avatarSprites.push(new PIXI.Sprite(player1Texture));
        this.avatarSprites.push(new PIXI.Sprite(player2Texture));
        this.avatarContainer.addChild(this.avatarSprites[0]);
        this.avatarContainer.addChild(this.avatarSprites[1]);
      // Regular Text styles; no BitmapFont registration
      for (let i = 1; i < 3; i++) {
        this[`player${i}HP`] = this.createTextSprite(`${this.level.HP} HP`, 18, '#FFFFFF');
      }
      const player1Background = new PIXI.Graphics()
          .roundRect(15, 10, 249, 68, 60)
          .fill(0x272735);
      player1Background.zIndex = -2;
      this.avatarContainer.addChild(player1Background);
      const player2Background = new PIXI.Graphics()
          .roundRect(CONFIG.BOARD.MAX_WIDTH - 80 - 249 + 60, 10, 249, 68, 60)
          .fill(0x272735);
      player2Background.zIndex = -2;
      this.avatarContainer.addChild(player2Background);

      this.avatarSprites[0].position.set(15, 15);
      this.avatarSprites[1].position.set(CONFIG.BOARD.MAX_WIDTH - 80, 15);
      // this.avatarSprites[0].filters = [new OutlineFilter(5, 0xffd828)];
      // this.avatarSprites[1].filters = [new OutlineFilter(5, 0x4b67a7)];
      const p = new PIXI.Graphics();
      p.circle(CONFIG.BOARD.MAX_WIDTH - 49, 44, 29)
          .circle(44, 44, 29)
          .fill(0x000000);
      this.avatarContainer.addChild(p);
      this.avatarSprites[0].mask = p;
      this.avatarSprites[1].mask = p;
      this.player1HP.position.set(115, 40);
      this.player2HP.position.set(CONFIG.BOARD.MAX_WIDTH - 170, 40);

      const player1Name = this.createTextSprite(this.playerAvatars[EPlayer.Human].name, 18, '#FFFFFF');
      const player2Name = this.createTextSprite(this.playerAvatars[EPlayer.AI].name, 18, '#FFFFFF');
      player1Name.position.set(110, 15);
      player2Name.anchor.set(1);
      player2Name.position.set(CONFIG.BOARD.MAX_WIDTH - 100, 45);
      this.avatarContainer.addChild(player1Name);
      this.avatarContainer.addChild(player2Name);
      this.avatarContainer.addChild(this.player2HP);
      this.avatarContainer.addChild(this.player1HP);

      this.player2HPBar = new PIXI.Graphics()
          .rect(CONFIG.BOARD.MAX_WIDTH - 90, 40, 150, 20)
          .fill(0xFFFFFF);
      this.player2HPBar.tint = 0x0ec468;
      this.player2HPBar.zIndex = -1;
      this.player2HPBar.pivot.set(+this.player2HPBar.width, 0);
      this.avatarContainer.addChild(this.player2HPBar);
      this.player1HPBar = new PIXI.Graphics()
          .rect(85, 40, 150, 20)
          .fill(0xFFFFFF);
      this.player1HPBar.tint = 0x0ec468;
      this.player1HPBar.zIndex = -1;
      this.player1HPBar.pivot.set(0);
      this.avatarContainer.addChild(this.player1HPBar);
      // this.avatarSprites[1].scale.set(0.35)
      // this.avatarSprites[0].scale.set(0.35)
      this.rightOutline = new PIXI.Graphics();
      this.rightOutline.circle(CONFIG.BOARD.MAX_WIDTH - 49, 44, 34).fill(0xFFFFFF);
      this.rightOutline.tint = this.inactiveColor;
      this.rightOutline.zIndex = -1;
      this.avatarContainer.addChild(this.rightOutline);
      this.leftOutline = new PIXI.Graphics();
      this.leftOutline.circle(44, 44, 34).fill(0xFFFFFF);
      this.leftOutline.tint = this.activeColor;
      this.leftOutline.zIndex = -2;
      this.avatarContainer.addChild(this.leftOutline);

    },
    redraw() {
      // Use the service board as a mask, then populate with seed-based gems
      this.gemsMap = this.gameService.getBoard();
      this.gemsToInsert = [];
      for (let col = 0; col < this.gemsMap[0].length; col++) {
        this.gemsToInsert.push([]);
      }
    },
    populate() {
      let map = this.gemsMap;
      for (let line = map.length - 1; line >= 0; line--) {
        for (let col = map[line].length - 1; col >= 0; col--) {
          if (map[line][col]) {
            //choose a gem by random from shared seed
            let gemType = this.gameService.seed.pop();

            /**
             * check if the new type will create a match
             */
            let maxloops = 100;
            if (map[line].length - col > 2 && map.length - line > 2) {
              //check down and right matches
              while (
                  (
                      (
                          this.gemsMap[line][col + 1].type === this.gemsMap[line][col + 2].type
                          && this.gemsMap[line][col + 1].type === gemType
                      )
                      || (
                          this.gemsMap[line + 1][col].type === this.gemsMap[line + 2][col].type
                          && this.gemsMap[line + 1][col].type === gemType
                      )
                  )
                  && maxloops > 0
                  ) {
                gemType = this.gameService.seed.pop();
                maxloops--;
              }
            } else if (map[line].length - col > 2 && map.length - line <= 2) {
              //check right match
              while (
                  (
                      (
                          this.gemsMap[line][col + 1].type === this.gemsMap[line][col + 2].type
                          && this.gemsMap[line][col + 1].type === gemType
                      )
                  )
                  && maxloops > 0
                  ) {
                gemType = this.gameService.seed.pop();
                maxloops--;
              }
            } else if (map[line].length - col <= 2 && map.length - line > 2) {
              //check down match
              while (
                  (
                      (
                          this.gemsMap[line + 1][col].type === this.gemsMap[line + 2][col].type
                          && this.gemsMap[line + 1][col].type === gemType
                      )
                  )
                  && maxloops > 0
                  ) {
                gemType = this.gameService.seed.pop();
                maxloops--;
              }
            }

            /**
             * Insert gem!
             */
                //get the gem type from pool
            let gem = this.gemPool.borrow(gemType);
            //insert gem to gem map
            this.gemsMap[line][col] = gem;
            gem.setAddress({line: line, col: col});
            //inform the board about this new gem
            this.gemsToInsert[col].push(gem);
            //insert movement to gem fall
            gem.addMovement(col * 61, line * 61);
            this.gemsAreMoving = true;

          } else {
            this.gemsMap[line][col] = -1;
          }
        }
      }
      this.addGemsToBoard();
      this.syncServiceBoard();
    },
    addGemsToBoard() {
      for (let col = 0; col < this.gemsToInsert.length; col++) {
        for (let i = 0; i < this.gemsToInsert[col].length; i++) {
          let gem = this.gemsToInsert[col][i];
          this.gemContainer.addChild(gem);
          gem.x = 61 * col;
          gem.y = -61 * i - 61;
          if (i === this.gemsToInsert[col].length - 1 && col === 0) {
            // костыль получается
            gem.addMovement(0, 0);
          }

        }
        this.gemsToInsert[col] = [];
      }
      this.syncServiceBoard();
    },
    syncServiceBoard() {
      // Rebuild logical service board from current gemMap types
      const board = [];
      for (let i = 0; i < this.gemsMap.length; i++) {
        board[i] = [];
        for (let j = 0; j < this.gemsMap[i].length; j++) {
          const cell = this.gemsMap[i][j];
          board[i][j] = cell === -1 ? 0 : cell.type;
        }
      }
      this.gameService.board = board;
    },
    removeGem(address) {
      let gem = this.gemsMap[address.line][address.col];
      this.gemContainer.removeChild(gem);
      this.gemPool.return(gem);
      //all gems above must fall
      let lastLineRemoved = address.line;
      for (let line = address.line; line > 0; line--) {
        if (this.gemsMap[line][address.col] !== -1
            && this.gemsMap[line][address.col] !== undefined) {
          let done = false;
          let count = line - 1;
          // if (address.line === 4)
          // 	debugger;
          while (!done && count >= 0) {
            if (this.gemsMap[count][address.col] !== -1) {
              this.gemsMap[line][address.col] = this.gemsMap[count][address.col];
              this.gemsMap[line][address.col].setAddress({line: line, col: address.col});
              this.gemsMap[line][address.col].addMovement(address.col * 61, line * 61);
              done = true;
              lastLineRemoved = count;
            }
            count--;

          }
        }
      }


      /**
       * Insert new gem!
       */
      this.gemsAreMoving = true;

      let gemType;
      do {
        gemType = this.gameService.seed.pop();
      } while (this.previousGemType === gemType);
      this.previousGemType = gemType;
      //get the gem type from pool
      let newGem = this.gemPool.borrow(gemType);

      //insert gem to gem map
      this.gemsMap[lastLineRemoved][address.col] = newGem;
      newGem.setAddress({line: lastLineRemoved, col: address.col});
      //inform the board about this new gem
      newGem.addMovement(address.col * 61, lastLineRemoved * 61);
      this.gemsToInsert[address.col].push(newGem);
      // debugger;
      //insert movement to gem fall
      setTimeout(() => {

        this.addGemsToBoard();
      })
    },
    pointerdown(event) {
      if (this.gemsAreMoving || this.hasAnimation /*|| залочить this.manager.lockEvents*/) {
        return;
      }
      this.eventIsDown = true;
      this.eventStartPoint = event.getLocalPosition(this.gemContainer);
    },
    pointermove(event) {
      if (!this.eventIsDown || this.gemSelected != null /*|| залочить this.manager.lockEvents*/) {
        return;
      }
      let pointNow = event.getLocalPosition(this.gemContainer);
      let gemAddress = {
        line: Math.floor(this.eventStartPoint.y / 61),
        col: Math.floor(this.eventStartPoint.x / 61)
      };
      let movement = {line: 0, col: 0};
      if (pointNow.x < this.eventStartPoint.x - 61 / 2) {
        //left
        movement.col = -1;
      } else if (pointNow.x > this.eventStartPoint.x + 61 / 2) {
        //right
        movement.col = 1;
      } else if (pointNow.y < this.eventStartPoint.y - 61 / 2) {
        //up
        movement.line = -1;
      } else if (pointNow.y > this.eventStartPoint.y + 61 / 2) {
        //down
        movement.line = 1;
      }
      if (movement.line != 0 || movement.col != 0) {
        this.eventIsDown = false;
        this.makingMove = true;
        this.insertGemSwap(gemAddress, movement);
      }
    },
    pointerup(event) {
      if (!this.eventIsDown  /* залочить  || this.manager.lockEvents*/) {
        return;
      }
      this.eventIsDown = false;

      if (this.gemSelected == null) {
        let firstAddress = {
          line: Math.floor(this.eventStartPoint.y / 61),
          col: Math.floor(this.eventStartPoint.x / 61)
        };
        let pointNow = event.getLocalPosition(this.gemContainer);
        let nowAddress = {
          line: Math.floor(pointNow.y / 61),
          col: Math.floor(pointNow.x / 61)
        };
        if (firstAddress.line == nowAddress.line && firstAddress.col == nowAddress.col) {
          //select the gem
          this.gemSelected = firstAddress;
        }
      } else {
        let pointNow = event.getLocalPosition(this.gemContainer);
        let nowAddress = {
          line: Math.floor(pointNow.y / 61),
          col: Math.floor(pointNow.x / 61)
        };

        if (this.gemSelected.line == nowAddress.line && this.gemSelected.col == nowAddress.col) {
          //unselect the gem
          this.gemSelected = null;
        } else {
          //check if is adjacent object
          if (nowAddress.line == this.gemSelected.line && this.gemSelected.col - 1 == nowAddress.col) {
            //left
            this.makingMove = true;
            this.insertGemSwap(this.gemSelected, {line: 0, col: -1}, false);
          } else if (nowAddress.line == this.gemSelected.line && this.gemSelected.col + 1 == nowAddress.col) {
            //right
            this.makingMove = true;
            this.insertGemSwap(this.gemSelected, {line: 0, col: 1}, false);
          } else if (nowAddress.line == this.gemSelected.line - 1 && this.gemSelected.col == nowAddress.col) {
            //top
            this.makingMove = true;
            this.insertGemSwap(this.gemSelected, {line: -1, col: 0}, false);
          } else if (nowAddress.line == this.gemSelected.line + 1 && this.gemSelected.col == nowAddress.col) {
            //bottom
            this.makingMove = true;
            this.insertGemSwap(this.gemSelected, {line: 1, col: 0}, false);
          }
        }

      }
    },

    insertGemSwap(address, movement, opponentsTurn = false) {
      try {
        if (this.gemSelected != null) {
          //reset selection
          this.gemSelected = null;
        }

        let newAdress = {
          line: address.line + movement.line,
          col: address.col + movement.col,
        };

        //Check if movement is going out of board
        if (
            newAdress.col < 0
            || newAdress.col >= this.gemsMap[0].length
            || newAdress.line < 0
            || newAdress.line >= this.gemsMap.length
        ) {
          return;
        }

        // Validate move locally against current board state
        const success = this.willSwapCreateMatch(address, newAdress);
        if (success) {
          // Perform logical swap in map before animating
          this.gemsAreMoving = true;
          const gemA = this.gemsMap[address.line][address.col];
          const gemB = this.gemsMap[newAdress.line][newAdress.col];
          this.gemsMap[address.line][address.col] = gemB;
          this.gemsMap[newAdress.line][newAdress.col] = gemA;
          // Animate to their new grid positions
          gemA.addMovement(newAdress.col * 61, newAdress.line * 61);
          gemB.addMovement(address.col * 61, address.line * 61);
          this.gemsSwapping.push(newAdress);
          this.gemsSwapping.push(address);

          if (!opponentsTurn && this.makingMove) {
            if (this.volume) {
              sound.play('gemMovement');
            }
            this.makingMove = false;
          }
        }
      } catch (e) {
        console.error(e);
      }
    },
    reverseGemsSwap() {
      if (this.gemsSwapping.length === 0) {
        return;
      }
      let gems = this.gemsSwapping;
      let tempGem = this.gemsMap[gems[0].line][gems[0].col];

      //reverse positions
      this.gemsMap[gems[0].line][gems[0].col] = this.gemsMap[gems[1].line][gems[1].col];
      this.gemsMap[gems[1].line][gems[1].col] = tempGem;

      //insert movements
      this.gemsAreMoving = true;
      this.gemsMap[gems[0].line][gems[0].col].addMovement(gems[0].col * 61, gems[0].line * 61, true);
      this.gemsMap[gems[1].line][gems[1].col].addMovement(gems[1].col * 61, gems[1].line * 61, true);

    },
    finishGemsSwap() {
      this.gemsSwapping = [];
      this.gemsAreMoving = false;
    },
    addScore(gemType) {
      switch (gemType) {
        case 1:
          this.currentDamage += 4;
          break;
        case 2:
          this.currentDamage += 3;
          break;
        case 3:
          this.currentHeal += 4;
          break;
        case 4:
          this.currentDamage += 1;
          break;
        case 5:
          this.currentDamage += 5;
          break;
        case 6:
          this.currentDamage += 2;
          break;
      }
    },
    checkAndInsertMatch3() {
      let lastType = 0;
      let lastSameGemsType = [];
      let gemsToExplode = []; //address listed here will explode gems at the end of this operation
      let map = this.gemsMap;
      /**
       * Check horizontally
       */
      for (let line = 0; line < map.length; line++) {
        for (let col = 0; col < map[line].length; col++) {
          if (map[line][col] != -1) {
            //check if this gem type is the same as the previous one
            if (lastType != map[line][col].type) {
              //before delete the sequence saved, we will check if match 3
              if (lastSameGemsType.length > 2) {
                //if match, save into gemsToExplode
                for (let i = 0; i < lastSameGemsType.length; i++) {
                  gemsToExplode.push(lastSameGemsType[i]);
                  this.addScore(lastType);
                }
              }
              //reset letiables
              lastType = map[line][col].type;
              lastSameGemsType = [];
              lastSameGemsType.push({line: line, col: col});
            } else {
              lastSameGemsType.push({line: line, col: col});
            }
          } else {
            if (lastSameGemsType.length > 2) {
              //if match, save into gemsToExplode
              for (let i = 0; i < lastSameGemsType.length; i++) {
                gemsToExplode.push(lastSameGemsType[i]);
                this.addScore(lastType);

              }
            }
            lastType = 0;
            lastSameGemsType = [];
          }
        }
        //after finish the line, we must check if match again
        if (lastSameGemsType.length > 2) {
          if (lastSameGemsType.length > 2) {
            //if match, save into gemsToExplode
            for (let i = 0; i < lastSameGemsType.length; i++) {
              gemsToExplode.push(lastSameGemsType[i]);
              this.addScore(lastType);

            }
          }
        }
        lastType = 0;
        lastSameGemsType = [];
      }

      /**
       * Check vertically
       */
      lastType = 0;
      lastSameGemsType = [];
      for (let col = 0; col < map[0].length; col++) {
        for (let line = 0; line < map.length; line++) {
          if (map[line][col] != -1) {
            //check if this gem type is the same as the previous one
            if (lastType != map[line][col].type) {
              //before delete the sequence saved, we will check if match 3
              if (lastSameGemsType.length > 2) {
                //if match, save into gemsToExplode
                for (let i = 0; i < lastSameGemsType.length; i++) {
                  gemsToExplode.push(lastSameGemsType[i]);
                  this.addScore(lastType);

                }
              }
              //reset variables
              lastType = map[line][col].type;

              lastSameGemsType = [];
              lastSameGemsType.push({line: line, col: col});
            } else {
              lastSameGemsType.push({line: line, col: col});
            }
          } else {
            if (lastSameGemsType.length > 2) {
              //if match, save into gemsToExplode
              for (let i = 0; i < lastSameGemsType.length; i++) {
                gemsToExplode.push(lastSameGemsType[i]);
                this.addScore(lastType);

              }
            }
            lastType = 0;
            lastSameGemsType = [];
          }
        }
        //after finish the column, we must check if match again
        if (lastSameGemsType.length > 2) {
          if (lastSameGemsType.length > 2) {
            //if match, save into gemsToExplode
            for (let i = 0; i < lastSameGemsType.length; i++) {
              gemsToExplode.push(lastSameGemsType[i]);
              this.addScore(lastType);

            }
          }
        }
        lastType = 0;
        lastSameGemsType = [];
      }

      if (gemsToExplode.length > 0) {
        for (let i = 0; i < gemsToExplode.length; i++) {
          let gemAddress = gemsToExplode[i];
          map[gemAddress.line][gemAddress.col].insertExplosion(gemAddress);

        }
        this.hasAnimation = true;
        if (this.interactive) {
          if (gemsToExplode.length > 4
              && (gemsToExplode.every((el) => gemsToExplode[0].col === el.col)
                  || gemsToExplode.every((el) => gemsToExplode[0].row === el.row))) {
            this.tntAvailable = true;
          } else if (gemsToExplode.length > 3
              && (gemsToExplode.every((el) => gemsToExplode[0].col === el.col)
                  || gemsToExplode.every((el) => gemsToExplode[0].row === el.row))) {
            this.dynamiteAvailable = true;
          }
        }
        this.gemsPopped = true;
        return true;
      } else {
        return false;
      }
    },
    endAnimation() {
      this.hasAnimation = false;
    },
    updateCanvasHitArea() {
      this.app.stage.hitArea = new PIXI.Rectangle(
          0,
          0,
          this.app.renderer.width,
          this.app.renderer.height
      );
    },

    resetState() {
      if (this.app) {
        if (this._resizeHandler) {
          window.removeEventListener('resize', this._resizeHandler);
          this._resizeHandler = null;
        }
        this.app.destroy(true);
      }

      this.app = null;

      if (this.$refs.game) {
        this.$refs.game.innerHTML = null;
      }

      this.players = {};
      this.player = null;

      // this.setRoomState(this.gameStatuses.init);
    },
    tntAvailability(tntAvailable) {
      if (!this.tntSprite) return;
      if (tntAvailable) {
        this.tntSprite.alpha = 1;
        this.tntSprite.eventMode = 'static';
        this.tntSprite.cursor = 'pointer';
      } else {
        this.tntSprite.alpha = 0.5;
        this.tntSprite.eventMode = 'none';
        this.tntSprite.cursor = 'default';
      }
    },
  },
  watch: {
    interactive(current) {
      if (this.gemContainer) {
        this.gemContainer.eventMode = current ? 'dynamic' : 'none';
        this.gemContainer.cursor = current ? 'pointer' : 'default';
      }
    },
    currentPlayer(current) {
      if (this.interactive) {
        this.tntAvailability(this.tntAvailable);
        this.setDynamiteAvailability(this.dynamiteAvailable);
      } else {
        this.tntAvailability(false);
        this.setDynamiteAvailability(false);
      }
      setTimeout(() => {
        if (this.leftOutline) {
          if (current === EPlayer.Human) {
            this.leftOutline.tint = this.activeColor;
            this.rightOutline.tint = this.inactiveColor;
          } else {
            this.rightOutline.tint = this.activeColor;
            this.leftOutline.tint = this.inactiveColor;
          }
        }
      }, 600);
    },
    gemsAreMoving(current) {
      if (current || this.hasAnimation) {
        this.interactive = false;
      } else {
        // All cascades finished. Apply accumulated damage/heal to service, update HP/score, then switch turn.
        if (this.gemsPopped) {
          const result = {damage: this.currentDamage, heal: this.currentHeal};
          const {hp, gameOver} = this.gameService.applyMoveResult(this.currentPlayer, result);
          this.player1HPValue = hp[EPlayer.Human];
          this.player2HPValue = hp[EPlayer.AI];
          this.player1Score = this.gameService.getScore(EPlayer.Human);
          this.player2Score = this.gameService.getScore(EPlayer.AI);
          this.gameOver = gameOver;
          this.refreshHPBars();
          // reset move accumulators
          this.currentDamage = 0;
          this.currentHeal = 0;
          this.gemsPopped = false;

          // Switch player only after cascades
          if (!this.gameOver) {
            this.currentPlayer = this.currentPlayer === EPlayer.Human ? EPlayer.AI : EPlayer.Human;
            // Update outlines
            if (this.leftOutline && this.rightOutline) {
              if (this.currentPlayer === EPlayer.Human) {
                this.leftOutline.tint = this.activeColor;
                this.rightOutline.tint = this.inactiveColor;
              } else {
                this.leftOutline.tint = this.inactiveColor;
                this.rightOutline.tint = this.activeColor;
              }
            }
            // Trigger AI move after short delay
            if (this.currentPlayer === EPlayer.AI) {
              setTimeout(() => {
                this.robotPlay();
              }, 400 + Math.random() * 1300);
            }
          }
        }
      }
      this.interactive = this.currentPlayer === EPlayer.Human;
    }
  }
}
</script>

<style>
.game {
  width: 100vw;
  height: 100vh;
}
</style>
