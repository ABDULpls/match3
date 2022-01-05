<template>
	<div>
		<template v-if="!app">
			<GameLoader/>
		</template>
		<template v-show="app">
			<div class="game" ref="game" id="game" :style="{/*height: '100%', width: `${this.gameWidth}px`*/}">
			</div>
		</template>
	</div>
</template>

<script>
import GameLoader from "./Loader";
import {mapState, mapGetters, mapMutations} from "vuex";
import {SET_CURRENT_PLAYER, SET_STATE} from '../../../js/store/types';
import {roomInPlay, roomInWait} from '../../../js/utils/room';
import * as PIXI from "pixi.js-legacy";
import GemPool from "../src/Game/GemPool";
import CONFIG from "../src/config";
import {OutlineFilter} from "pixi-filters";
import {AdvancedBloomFilter} from "pixi-filters";
import {BevelFilter} from "pixi-filters";
import _cloneDeep from "lodash/cloneDeep";
import _debounce from "lodash/debounce";
import PIXISound from "pixi-sound";


PIXI.utils.skipHello();

export default {
	name: "Match3",

	components: {
		GameLoader
	},

	mixins: [gameMixins],

	async created() {
		await window.initSocketIo();
		this.init();
		this.addGemsToBoard = _debounce(this.addGemsToBoard, 30, {
			leading: false,
			trailing: true
		});
	},

	data: function() {
		return {
			app: null,
			interactive: false,
			// lastRefreshId: null,
			level: CONFIG.LEVEL,
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
			gemsMap: [],
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
			validMove: false,
			gameWidth: CONFIG.BOARD.MAX_WIDTH,
			logicalWidth: CONFIG.BOARD.MAX_WIDTH,
			logicalHeight: CONFIG.BOARD.MAX_HEIGHT,
			newWidth: CONFIG.BOARD.MAX_WIDTH,
			newHeight: CONFIG.BOARD.MAX_HEIGHT,
			players: {},
			playerIds: [],
			robotId: null,
			maxHP: CONFIG.LEVEL.HP,
			player1HP: null,
			player2HP: null,
			player1HPBar: {},
			player2HPBar: {},
			playerAvatars: [],
			avatarSprites: [],
			avatarContainer: null,
			player: null,
			userId: {},
			moverId: null,
			currentMoverId: null,
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
		...mapState({
			user: state => state.user,
			socket: state => state.socket,
			roomId: state => state.room.id,
			gameStatus: state => state.room.game.status,
			volume: state => state.room.volume,
			currentPlayer: state => state.room.currentPlayer,

		}),

		...mapGetters({
			room: "room/getData"
		}),
		currentRound() {
			return this.round;
		},
		currentPlayer() {
			return this.players[this.currentMoverId];
		},
	},
	methods: {
		...mapMutations("room", {
			setRoomState: SET_STATE,
			setCurrentPlayer: SET_CURRENT_PLAYER,

		}),
		resizeHandler() {
			// const scaleFactor = Math.min(
			// 	this.$refs.game.clientWidth / this.logicalWidth,
			// 	this.$refs.game.clientHeight / this.logicalHeight
			// )
			// this.newWidth = this.$refs.game.clientWidth;
			// this.newHeight = this.$refs.game.clientHeight;
			// this.app.renderer.view.style.width = `${this.logicalWidth}px`;
			// this.app.renderer.view.style.height = `${this.logicalHeight}px`;
			//
			// // this.app.renderer.resize(this.newWidth, this.newHeight)
			// this.app.stage.scale.set(scaleFactor)
			for (let i = 0; i < 5; i++) {
				const scaleFactor = Math.min(
					this.$refs.game.clientWidth / this.logicalWidth,
					this.$refs.game.clientHeight / this.logicalHeight
				);
				// ЛЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯ КАК это хуита работает дааа ллее
				if (this.$refs.game.clientWidth < this.logicalWidth) {

					this.newWidth = this.$refs.game.clientWidth;
					this.newHeight = this.newWidth * 1.094 /** 1.094*/;
				} else {
					this.newWidth = this.logicalWidth;
					this.newHeight = this.logicalHeight;
				}
				this.app.renderer.view.style.width = `${this.newWidth}px`;
				this.app.renderer.view.style.height = `${this.newHeight}px`;

				this.app.renderer.resize(this.newWidth, this.newHeight);
				this.app.stage.scale.set(scaleFactor);
			}
		},
		init() {
			this.resetState();
			this.checkRoomExists();
			this.socketListeners();
			this.loaderShr = PIXI.Loader.shared;
			this.loader = new PIXI.Loader();
			PIXISound.sound.add('explosion', 'https://cdn.gamezz.io/games/match3/explosion.mp3');
			PIXISound.sound.add('gemMovement', 'https://cdn.gamezz.io/games/match3/jeweldrop.mp3');

		},

		socketListeners() {
			this.$socket.on("initGame", this.initGame.bind(this));
			this.$socket.on("initMove", this.onInitMove.bind(this));
			this.$socket.on("initSeed", this.onInitSeed.bind(this));
			this.$socket.on("moverChange", this.onMoverChange.bind(this));
			this.$socket.on("gameStarted", this.onGameStarted.bind(this));
		},
		onMoverChange(userId, player1HP, player2HP, /*lastRefreshId*/) {
			this.currentMoverId = +userId;
			this.currentDamage = 0;
			this.currentHeal = 0;
			if (this.player1HP && this.player2HP) {
				this.player1HPBar.clear();
				this.player1HPBar = new PIXI.Graphics()
					.beginFill(0xFFFFFF)
					.drawRect(85, 40, player1HP * 150 / this.maxHP, 20)
					.endFill();
				if (player1HP / this.maxHP > 0.30)
					this.player1HPBar.tint = 0x0ec468;
				else
					this.player1HPBar.tint = 0xDD4A2A;
				this.player1HPBar.zIndex = -1;
				this.avatarContainer.addChild(this.player1HPBar);

				this.player2HPBar.clear();
				this.player2HPBar = new PIXI.Graphics()
					.beginFill(0xFFFFFF)
					.drawRect(CONFIG.BOARD.MAX_WIDTH - 90, 40, player2HP * 150 / this.maxHP, 20)
					.endFill();
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
			this.interactive = this.player.userId === this.currentMoverId;
			if (this.robotId === this.currentMoverId) {
				this.robotPlay();
			}
		},
		robotPlay() {
			setTimeout(() => {
				if (parseInt(this.player1HP.text) <= 0 || parseInt(this.player2HP.text) <= 0)
					return;
				const gemsMap = [];
				const address = {};
				const movement = {};
				let maxScore = 0;
				for (let i = 0; i < this.gemsMap.length; i++) {
					gemsMap[i] = [];
					for (let j = 0; j < this.gemsMap[0].length; j++) {
						gemsMap[i][j] = this.gemsMap[i][j].type;
					}
				}
				for (let i = 0; i < gemsMap.length; i++) {
					for (let j = 0; j < gemsMap[0].length; j++) {
						if (j > 0 && j < 8 && i < 6
							&& maxScore < this.convertTypeToScore(gemsMap[i][j])
							&& gemsMap[i][j] === gemsMap[i][j + 1]
							&& gemsMap[i][j + 1] === gemsMap[i + 1][j - 1]) {
							maxScore = this.convertTypeToScore(gemsMap[i][j]);
							address.line = i + 1;
							address.col = j - 1;
							movement.line = -1;
							movement.col = 0;
						} else if (j < 8 && j > 0 && i > 0
							&& maxScore < this.convertTypeToScore(gemsMap[i][j])
							&& gemsMap[i][j] === gemsMap[i][j + 1]
							&& gemsMap[i][j + 1] === gemsMap[i - 1][j - 1]) {
							maxScore = this.convertTypeToScore(gemsMap[i][j]);
							address.line = i - 1;
							address.col = j - 1;
							movement.line = +1;
							movement.col = 0;
						} else if (j > 0 && j < 8 && i > 0
							&& maxScore < this.convertTypeToScore(gemsMap[i][j])
							&& gemsMap[i][j] === gemsMap[i][j - 1]
							&& gemsMap[i][j - 1] === gemsMap[i - 1][j + 1]) {
							maxScore = this.convertTypeToScore(gemsMap[i][j]);
							address.line = i - 1;
							address.col = j + 1;
							movement.line = +1;
							movement.col = 0;
						} else if (j > 0 && j < 8 && i < 6
							&& maxScore < this.convertTypeToScore(gemsMap[i][j])
							&& gemsMap[i][j] === gemsMap[i][j - 1]
							&& gemsMap[i][j - 1] === gemsMap[i + 1][j + 1]) {
							maxScore = this.convertTypeToScore(gemsMap[i][j]);
							address.line = i + 1;
							address.col = j + 1;
							movement.line = -1;
							movement.col = 0;
						} else if (i < 6 && i > 0 && j < 8
							&& maxScore < this.convertTypeToScore(gemsMap[i][j])
							&& gemsMap[i][j] === gemsMap[i + 1][j]
							&& gemsMap[i + 1][j] === gemsMap[i - 1][j + 1]) {
							maxScore = this.convertTypeToScore(gemsMap[i][j]);
							address.line = i - 1;
							address.col = j + 1;
							movement.line = 0;
							movement.col = -1;
						} else if (i < 6 && i > 0 && j > 0
							&& maxScore < this.convertTypeToScore(gemsMap[i][j])
							&& gemsMap[i][j] === gemsMap[i + 1][j]
							&& gemsMap[i + 1][j] === gemsMap[i - 1][j - 1]) {
							maxScore = this.convertTypeToScore(gemsMap[i][j]);
							address.line = i - 1;
							address.col = j - 1;
							movement.line = 0;
							movement.col = +1;
						} else if (j > 0 && i > 0 && i < 6
							&& maxScore < this.convertTypeToScore(gemsMap[i][j])
							&& gemsMap[i][j] === gemsMap[i - 1][j]
							&& gemsMap[i - 1][j] === gemsMap[i + 1][j - 1]) {
							maxScore = this.convertTypeToScore(gemsMap[i][j]);
							address.line = i + 1;
							address.col = j - 1;
							movement.line = 0;
							movement.col = +1;
						} else if (j < 8 && i > 0 && i < 6
							&& maxScore < this.convertTypeToScore(gemsMap[i][j])
							&& gemsMap[i][j] === gemsMap[i - 1][j]
							&& gemsMap[i - 1][j] === gemsMap[i + 1][j + 1]) {
							maxScore = this.convertTypeToScore(gemsMap[i][j]);
							address.line = i + 1;
							address.col = j + 1;
							movement.line = 0;
							movement.col = -1;
						} else if (i > 0 && j < 7
							&& maxScore < this.convertTypeToScore(gemsMap[i][j])
							&& gemsMap[i][j] === gemsMap[i][j + 2]
							&& gemsMap[i][j + 2] === gemsMap[i - 1][j + 1]) {
							maxScore = this.convertTypeToScore(gemsMap[i][j]);
							address.line = i - 1;
							address.col = j + 1;
							movement.line = +1;
							movement.col = 0;
						} else if (j > 0 && j < 7
							&& maxScore < this.convertTypeToScore(gemsMap[i][j])
							&& gemsMap[i][j] === gemsMap[i][j - 1]
							&& gemsMap[i][j - 1] === gemsMap[i][j + 2]) {
							maxScore = this.convertTypeToScore(gemsMap[i][j]);
							address.line = i;
							address.col = j + 2;
							movement.line = 0;
							movement.col = -1;
						} else if (j > 1 && j < 8
							&& maxScore < this.convertTypeToScore(gemsMap[i][j])
							&& gemsMap[i][j] === gemsMap[i][j + 1]
							&& gemsMap[i][j + 1] === gemsMap[i][j - 2]) {
							maxScore = this.convertTypeToScore(gemsMap[i][j]);
							address.line = i;
							address.col = j - 2;
							movement.line = 0;
							movement.col = +1;
						} else if (i > 0 && i < 5
							&& maxScore < this.convertTypeToScore(gemsMap[i][j])
							&& gemsMap[i][j] === gemsMap[i - 1][j]
							&& gemsMap[i - 1][j] === gemsMap[i + 2][j]) {
							maxScore = this.convertTypeToScore(gemsMap[i][j]);
							address.line = i + 2;
							address.col = j;
							movement.line = -1;
							movement.col = 0;
						} else if (i > 1 && i < 6
							&& maxScore < this.convertTypeToScore(gemsMap[i][j])
							&& gemsMap[i][j] === gemsMap[i + 1][j]
							&& gemsMap[i + 1][j] === gemsMap[i - 2][j]) {
							maxScore = this.convertTypeToScore(gemsMap[i][j]);
							address.line = i - 2;
							address.col = j;
							movement.line = +1;
							movement.col = 0;
						} else if (i > 0 && j > 1
							&& maxScore < this.convertTypeToScore(gemsMap[i][j])
							&& gemsMap[i][j] === gemsMap[i][j - 2]
							&& gemsMap[i][j - 2] === gemsMap[i - 1][j - 1]) {
							maxScore = this.convertTypeToScore(gemsMap[i][j]);
							address.line = i - 1;
							address.col = j - 1;
							movement.line = +1;
							movement.col = 0;
						} else if (i < 6 && j < 7
							&& maxScore < this.convertTypeToScore(gemsMap[i][j])
							&& gemsMap[i][j] === gemsMap[i][j + 2]
							&& gemsMap[i][j + 2] === gemsMap[i + 1][j + 1]) {
							maxScore = this.convertTypeToScore(gemsMap[i][j]);
							address.line = i + 1;
							address.col = j + 1;
							movement.line = -1;
							movement.col = 0;
						} else if (i > 0 && j < 7
							&& maxScore < this.convertTypeToScore(gemsMap[i][j])
							&& gemsMap[i][j] === gemsMap[i][j + 2]
							&& gemsMap[i][j + 2] === gemsMap[i - 1][j + 1]) {
							maxScore = this.convertTypeToScore(gemsMap[i][j]);
							address.line = i - 1;
							address.col = j + 1;
							movement.line = +1;
							movement.col = 0;
						} else if (i < 6 && j > 1
							&& maxScore < this.convertTypeToScore(gemsMap[i][j])
							&& gemsMap[i][j] === gemsMap[i][j - 2]
							&& gemsMap[i][j - 2] === gemsMap[i + 1][j - 1]) {
							maxScore = this.convertTypeToScore(gemsMap[i][j]);
							address.line = i + 1;
							address.col = j - 1;
							movement.line = -1;
							movement.col = 0;
						} else if (i > 0 && j > 1
							&& maxScore < this.convertTypeToScore(gemsMap[i][j])
							&& gemsMap[i][j] === gemsMap[i][j - 2]
							&& gemsMap[i][j - 2] === gemsMap[i - 1][j - 1]) {
							maxScore = this.convertTypeToScore(gemsMap[i][j]);
							address.line = i - 1;
							address.col = j - 1;
							movement.line = +1;
							movement.col = 0;
						} else if (i > 1 && i < 6
							&& maxScore < this.convertTypeToScore(gemsMap[i][j])
							&& gemsMap[i][j] === gemsMap[i + 1][j]
							&& gemsMap[i + 1][j] === gemsMap[i - 2][j]) {
							maxScore = this.convertTypeToScore(gemsMap[i][j]);
							address.line = i - 2;
							address.col = j;
							movement.line = +1;
							movement.col = 0;
						} else if (i > 0 && i < 5
							&& maxScore < this.convertTypeToScore(gemsMap[i][j])
							&& gemsMap[i][j] === gemsMap[i - 1][j]
							&& gemsMap[i - 1][j] === gemsMap[i + 2][j]) {
							maxScore = this.convertTypeToScore(gemsMap[i][j]);
							address.line = i + 2;
							address.col = j;
							movement.line = -1;
							movement.col = 0;
						}
					}
				}
				// if (!address.col) {
				// 	this.populate();
				// 	this.robotPlay()
				// 	return;
				// }
				this.makingMove = true;
				this.valideMove = true;
				this.gemsPopped = true;
				this.insertGemSwap(address, movement, false);
				// const score = {
				// 	damage: this.currentDamage,
				// 	heal: this.currentHeal
				// };
				// this.$socket.emit('handRefresh', this.robotId, true, score);
				// this.gemsPopped = false;
				// this.validMove = false;

			}, 3000);
		},
		initGame({options, player}) {
			this.resetState();
			this.player = player;
			this.options = options;
		},
		onInitSeed(seed, currentMoverId) {
			this.seed = seed;
			this.setCurrentPlayer(this.players[0].userId === currentMoverId ? this.players[0] : this.players[1]);
			this.onMoverChange(currentMoverId);
		},
		onInitMove(currentMoverId, address, movement) {
			// this.moverId = +moverId;
			// this.currentMoverId = currentMoverId;
			if (this.currentMoverId === this.player.userId)
				return;
			if (movement === 'explosion') {
				this.explodeGems(address);
			} else {

				this.insertGemSwap(address, movement, true);
			}
		},

		onGameStarted({players, forPlayer}) {
			this.players = players;
			if (forPlayer && forPlayer !== this.user.userId) {
				return false;
			}
			for (const player in players) {
				this.playerAvatars.push([players[player].userId, players[player].avatarThumb, players[player].username]);
				this.playerIds.push(players[player].userId);
			}
			for (let i = 0; i < 2; i++) {
				if (this.players[i].isRobot) {
					this.robotId = this.players[i].userId;
				}
			}
			this.playerAvatars.sort();
			this.playerIds.sort();
			this.loader
				.add("sprites", "https://gamezz.io/games/match3/sprites.json")
				.add(`player1`, this.playerAvatars[0][1])
				.add(`player2`, this.playerAvatars[1][1])
				.add("back", "https://gamezz.io/games/match3/back.jpg")
				.load((_, resources) => {
					this.setRoomState(this.gameStatuses.play);
					this.$refs.game.innerHTML = null;
					this.app = new PIXI.Application({
						antialias: true,
						resolution: window.devicePixelRatio || 1,
						autoDensity: true,
						transparent: true,
						powerPreference: 'high-performance',
						backgroundColor: CONFIG.BACKGROUND_COLOR,
					});
					PIXI.settings.PRECISION_FRAGMENT = 'highp';
					PIXI.settings.ROUND_PIXELS = true;
					// this.renderer = new PIXI.WebGLRenderer(
					// 	window.innerWidth,
					// 	window.innerHeight,
					// 	{view:this.canvas,
					// 		antialias:true,
					// 		forceFXAA:true,
					// 		powerPreference : 'high-performance'}
					// )

					this.$refs.game.appendChild(this.app.view);
					this.app.stage.sortableChildren = true;
					// без Скрола страницы на канвасе
					this.app.renderer.plugins.interaction.autoPreventDefault = true;
					this.app.renderer.view.style.touchAction = "none";
					this.app.renderer.resize(this.logicalWidth, this.logicalHeight);

					window.addEventListener('resize', this.resizeHandler, false);

					this.playField = new PIXI.Container();
					this.playField.sortableChildren = true;
					this.playField.zIndex = 0;
					this.app.stage.addChild(this.playField);
					// this.playField.pivot.set(CONFIG.BOARD.MAX_WIDTH / 2, CONFIG.BOARD.MAX_HEIGHT / 2)
					// this.playField.x = CONFIG.BOARD.MAX_WIDTH / 2
					// this.playField.y = CONFIG.BOARD.MAX_HEIGHT / 2

					PIXI.BitmapFont.from("TitleFont", {
						fill: "#FFFFFF",
						fontSize: 42,
					});

					// this.movesLeft = new PIXI.BitmapText(`150`,
					// 	{
					// 		fontName: "TitleFont",
					// 		fontSize: 22,
					// 		align: "right"
					// 	})
					//
					// this.tilesLeft = new PIXI.BitmapText(`150`,
					// 	{
					// 		fontName: "TitleFont",
					// 		fontSize: 22,
					// 		align: "right"
					// 	})
					// // this.movesLeft.position.set(CONFIG.BOARD.MAX_WIDTH/2, 20)
					// this.app.stage.addChild(this.movesLeft)
					// this.app.stage.addChild(this.tilesLeft)
					// this.movesLeft.position.set(100, 10)
					// this.tilesLeft.position.set(500, 10)


					let gemTextures = [];
					for (let i = 0; i < Object.keys(this.loader.resources.sprites.textures).length; i++) {
						gemTextures.push(Object.values(this.loader.resources.sprites.textures)[i]);
					}
					this.gemPool = new GemPool(this, gemTextures);
					// this.$socket.emit('handRefresh', this.player.userId,)
					this.gemContainer = new PIXI.Container();
					this.gemContainer.zIndex = 0;
					this.gemContainer.y += 90;
					this.gemContainer.x += 8;
					this.playField.y += 90;
					this.playField.x += 8;
					this.app.stage.addChild(this.gemContainer);
					this.gemContainer.on("pointerdown", this.pointerdown);
					this.gemContainer.on("pointermove", this.pointermove);
					this.gemContainer.on("pointerup", this.pointerup);
					this.gemContainer.interactive = this.interactive;
					this.gemContainer.buttonMode = this.interactive;
					this.gemContainer.sortableChildren = true;


					this.dynamiteSprite = new PIXI.Sprite(gemTextures[6]);
					this.tntSprite = new PIXI.Sprite(gemTextures[7]);
					this.app.stage.addChild(this.dynamiteSprite);
					this.app.stage.addChild(this.tntSprite);
					this.tntSprite.anchor.set(0.5);
					this.dynamiteSprite.anchor.set(0.5);
					this.tntSprite.position.set(145, this.logicalHeight - 60);
					this.dynamiteSprite.position.set(45, this.logicalHeight - 60);

					// first move  explosion test
					this.dynamiteSprite.alpha = 1;
					this.tntSprite.alpha = 0.5;
					this.dynamiteSprite.interactive = true;
					this.tntSprite.interactive = false;


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

					this.redraw(this.level.board);
					this.app.ticker.maxFPS = 60;

					this.populate();

					this.app.ticker.add(this.update);
					this.drawPlayers();
					this.drawBackground();
					this.drawReference(gemTextures);
					this.drawGemsBackground();
					this.resizeHandler();
					this.updateCanvasHitArea();
				});
		},
		drawBackground() {
			const gradient = (from, to) => {
				const c = document.createElement("canvas");
				const ctx = c.getContext("2d");
				const grd = ctx.createLinearGradient(0, 0, this.logicalWidth / 2, this.logicalHeight / 2);
				grd.addColorStop(0, from);
				grd.addColorStop(1, to);
				ctx.fillStyle = grd;
				ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
				return new PIXI.Texture.from(c);
			};
			const background = new PIXI.Graphics()
				.beginTextureFill({
					texture: gradient('#48487b', '#48487b')
				})
				.drawRect(0, 0, this.logicalWidth, this.logicalHeight);
			background.zIndex = -7;

			this.app.stage.addChild(background);

		},
		drawReference(textures) {
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
				.beginFill(0x272735)
				.drawRoundedRect(210, this.logicalHeight - 85, 344, 60, 50)
				.endFill();
			background.zIndex = -5;
			this.app.stage.addChild(background);
			const explosivesBackground = new PIXI.Graphics()
				.beginFill(0x272735)
				.drawCircle(45, this.logicalHeight - 55, 41)
				.drawCircle(140, this.logicalHeight - 55, 41)
				.endFill();
			explosivesBackground.zIndex = -5;
			this.app.stage.addChild(explosivesBackground);
			const gemValue = new PIXI.BitmapText('-5     -4     -3     -2      -1     +4',
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
					background.beginFill(0x141319);
					background.drawRect(j * 61, i * 61, 60, 60);
					background.endFill();
					background.alpha = 0.4;
					background.zIndex = -6;
					this.playField.addChild(background);
				}
			}
			for (let i = 0; i < this.level.board.length + 1; i++) {
				const outline = new PIXI.Graphics();
				outline.lineStyle(1, 0xb29067)
					.moveTo(0, i * 61)
					.lineTo((this.level.board[0].length) * 61, i * 61);
				outline.zIndex = -5;
				this.gemContainer.addChild(outline);
			}
			for (let i = 0; i < this.level.board[0].length + 1; i++) {
				const outline = new PIXI.Graphics();
				outline.lineStyle(1, 0xb29067)
					.moveTo(i * 61, 0)
					.lineTo(i * 61, (this.level.board.length) * 61);
				outline.zIndex = -5;
				this.gemContainer.addChild(outline);
			}
		},
		onDynamiteDragStart(e) {
			// store a reference to the data
			// the reason for this is because of multitouch
			// we want to track the movement of this particular touch
			this.data = e.data;
			this.draggingDynamite = true;
		},
		onTntDragStart(e) {
			this.data = e.data;
			this.draggingTnt = true;
		},
		onDynamiteDragEnd() {
			this.draggingDynamite = false;
			if (this.data !== null) {
				const line = this.data.row;
				const col = this.data.col;

				const gemsToExplode = [
					{
						line: line,
						col: col
					},
					// {
					// 	line: line,
					// 	col: col
					// },
					// {
					// 	line: line - 1,
					// 	col: col
					// },
					// {
					// 	line: line,
					// 	col: col + 1
					// },
				];
				// if (line + 1 <= 6) {
				// 	gemsToExplode.push({
				// 		line: line,
				// 		col: col - 1
				// 	});
				// 	// gemsToExplode.push({
				// 	// 	line: line - 1,
				// 	// 	col: col
				// 	// });
				// 	// gemsToExplode.push({
				// 	// 	line: line,
				// 	// 	col: col + 1
				// 	// });
				// 	// gemsToExplode.push({
				// 	// 	line: this.data.row ,
				// 	// 	col: this.data.col - 1
				// 	// });
				//
				//
				// }

				if (this.data.row -1 >= 0) {
					gemsToExplode.push({
						line: this.data.row - 1,
						col: this.data.col
					});
				}
				if (this.data.row + 1 <= 6) {
					gemsToExplode.push({
						line: this.data.row + 1,
						col: this.data.col
					});
				}
				if (this.data.col - 1 >= 0) {
					gemsToExplode.push({
						line: this.data.row,
						col: this.data.col - 1
					});
				}
				if (this.data.col + 1 <= 8) {
					gemsToExplode.push({
						line: this.data.row,
						col: this.data.col + 1
					});
				}

				// yeah...
				this.dynamiteAvailable = false;
				this.dynamiteSprite.alpha = 0.5;
				this.dynamiteSprite.buttonMode = false;
				this.dynamiteSprite.interactive = false;
				this.validMove = true;
				this.explodeGems(gemsToExplode);
				this.$socket.emit('playTile', this.player.userId, gemsToExplode, 'explosion');
				if (this.volume) {
					PIXISound.play('explosion');
				}
			}
			for (let i = 0; i < this.playField.children.length; i++) {
				this.playField.children[i].alpha = 0.4;
			}
			this.dynamiteSprite.position.set(45, this.logicalHeight - 60);

			this.data = null;


		},
		onTntDragEnd() {
			this.draggingTnt = false;

			if (this.data !== null) {

				const gemsToExplode = [{
					line: this.data.row,
					col: this.data.col
				}];
				//scuffed
				if (this.data.row - 1 >= 0) {
					gemsToExplode.push({
						line: this.data.row + 1,
						col: this.data.col
					});
				}
				if (this.data.row + 1 <= 6) {
					gemsToExplode.push({
						line: this.data.row + 1,
						col: this.data.col
					});
				}
				if (this.data.col - 1 >= 0) {
					gemsToExplode.push({
						line: this.data.row,
						col: this.data.col - 1
					});
				}
				if (this.data.col + 1 <= 8) {
					gemsToExplode.push({
						line: this.data.row,
						col: this.data.col + 1
					});
				}
				if (this.data.col + 1 <= 8 && this.data.row + 1 <= 6) {
					gemsToExplode.push({
						line: this.data.row + 1,
						col: this.data.col + 1
					});
				}
				//scuffed
				if (this.data.col + 1 <= 8 && this.data.row - 1 >= 0) {
					gemsToExplode.push({
						line: this.data.row + 1,
						col: this.data.col + 1
					});
				}
				if (this.data.col - 1 >= 0 && this.data.row + 1 <= 6) {
					gemsToExplode.push({
						line: this.data.row + 1,
						col: this.data.col - 1
					});
				}
				// scuffed
				if (this.data.col - 1 >= 0 && this.data.row - 1 >= 0) {
					gemsToExplode.push({
						line: this.data.row + 1,
						col: this.data.col - 1
					});
				}
				this.validMove = true;
				this.explodeGems(gemsToExplode);
				this.tntAvailable = false;
				this.tntAvailable = false;
				this.tntSprite.alpha = 0.5;
				this.tntSprite.buttonMode = false;
				this.tntSprite.interactive = false;
				// this.tntAvailability(false)
				this.$socket.emit('playTile', this.player.userId, gemsToExplode, 'explosion');
				if (this.volume) {
					PIXISound.play('explosion');
				}
			}
			this.data = null;
			for (let i = 0; i < this.playField.children.length; i++) {
				this.playField.children[i].alpha = 0.4;
			}
			this.tntSprite.position.set(145, this.logicalHeight - 60);

		},
		explodeGems(gemsToExplode) {
			this.hasAnimation = true;
			this.gemsAreMoving = true;
			for (let i = 0; i < gemsToExplode.length; i++) {
				let gemAddress = gemsToExplode[i];
				if (this.gemsMap[gemAddress.line] && this.gemsMap[gemAddress.line][gemAddress.col]) {
					this.addScore(this.gemsMap[gemAddress.line][gemAddress.col].type);
					this.gemsMap[gemAddress.line][gemAddress.col].insertExplosion(gemAddress);
				}
				// else return;
			}
			// this.addGemsToBoard();
			this.gemsPopped = true;
			// if (gemsToExplode.length > 0) {
			// 	// console.log('GEMS EXPLODED  :: ' + gemsToExplode.length)
			// 	// console.log('BEFORE HAND REFRESH EMIT ' + this.player.userId + ' = ' + this.currentMoverId)
			// 	if (this.currentMoverId === this.player.userId &&) {
			// 		console.log('gems to explode: ' + gemsToExplode.length)
			// 		if (gemsToExplode.length > 4) {
			// 			this.tntAvailable = true;
			// 		} else if (gemsToExplode.length > 3) {
			// 			this.dynamiteAvailable = true;
			// 		}
			// 		// console.log('DAMAGE : ' + this.currentDamage)
			// 		// console.log('HEAL : ' + this.currentHeal)
			// 		// this.$socket.emit('handRefresh', this.player.userId)
			// 		// console.log('CHECK AND ISNERT MATCH 3 EMITT HAND REFRESHMETN')
			// 	}
			//
			// 	// send score to server	this.manager.increaseScore(gemsToExplode.length * 5)
			// 	return true;
			// } else {
			// 	return false;
			//
			// }
		},
		onDynamiteDragMove() {
			if (this.draggingDynamite) {
				const newPosition = this.data.getLocalPosition(this.app.stage);
				const col = Math.ceil((newPosition.x - 9) / 61) - 1;
				const row = Math.ceil((newPosition.y - 27) / 61) - 2;
				console.log(col, row);
				this.dynamiteSprite.position.x = newPosition.x;
				this.dynamiteSprite.position.y = newPosition.y;
				for (let i = 0; i < this.playField.children.length; i++) {
					this.playField.children[i].alpha = 0.4;
					this.playField.children[i].zIndex = -6;
				}
				if (col >= 0 && col <= 8 && row >= 0 && row <= 6) {
					this.data.col = col;
					this.data.row = row;
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
					this.data.col = null;
					this.data.row = null;
				}
			}
		},
		onTntDragMove() {
			if (this.draggingTnt) {
				const newPosition = this.data.getLocalPosition(this.app.stage);
				const col = Math.ceil((newPosition.x - 9) / 61) - 1;
				const row = Math.ceil((newPosition.y - 27) / 61) - 2;
				this.tntSprite.position.x = newPosition.x;
				this.tntSprite.position.y = newPosition.y;
				for (let i = 0; i < this.playField.children.length; i++) {
					this.playField.children[i].alpha = 0.4;
				}
				if (col >= 0 && col <= 8 && row >= 0 && row <= 6) {
					this.data.col = col;
					this.data.row = row;
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
					this.data.col = null;
					this.data.row = null;
				}
				//tnt explodes 0 1 when out of bounds
			}
		},

		update() {
			let gemmap = this.gemsMap;
			let hasGemMovement = false;
			for (let line = gemmap.length - 1; line >= 0; line--) {
				for (let col = gemmap[line].length - 1; col >= 0; col--) {
					if (gemmap[line][col] !== -1 && gemmap[line][col].update()) {
						hasGemMovement = true;
					}
				}
			}


			// console.log('has gem movent = ' + hasGemMovement + 'this gems moving = ' + this.gemsAreMoving)

			if (!this.hasAnimation && hasGemMovement === false && this.gemsAreMoving) {
				if (!this.checkAndInsertMatch3()) {
					this.reverseGemsSwap();
				} else {
					this.finishGemsSwap();
					// if (this.currentMoverId == this.player.userId) {
					// 	this.interactive = false;
					// console.log('handrefresh')
					// this.$socket.emit('handRefresh', this.player.userId)
					// }
				}
				this.gemsAreMoving = false;
			}

		},
		drawPlayers() {
			this.avatarContainer = new PIXI.Container;
			this.avatarContainer.sortableChildren = true;
			this.avatarContainer.zIndex = 6;
			this.avatarContainer.height = 150;
			this.app.stage.addChild(this.avatarContainer);

			const base = new PIXI.Graphics()
				.beginFill(0x48487b)
				.drawRect(0, 0, this.logicalWidth, 89)
				.endFill();
			base.zIndex = -3;
			this.avatarContainer.addChild(base);
			for (let i = 0; i < this.playerAvatars.length; i++) {
				this.avatarSprites.push(new PIXI.Sprite(this.loader.resources[`player${i + 1}`].texture));
				this.avatarContainer.addChild(this.avatarSprites[i]);
			}
			PIXI.BitmapFont.from("TitleFont", {
					fontWeight: 100,
					fill: "#FFFFFF",
					fontSize: 22,
				},
				{
					resolution: 4,
					chars: '#&*<>)({}[]_= +-$!|?.,;:' +
						'1234567890' +
						'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' +
						'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'
				});
			for (let i = 1; i < 3; i++) {
				this[`player${i}HP`] = new PIXI.BitmapText(`${this.level.HP} HP`,
					{
						fontName: "TitleFont",
						fontSize: 18,
						align: "right",
					}
				);
			}
			const player1Background = new PIXI.Graphics()
				.beginFill(0x272735)
				.drawRoundedRect(15, 10, 249, 68, 60)
				.endFill();
			player1Background.zIndex = -2;
			this.avatarContainer.addChild(player1Background);
			const player2Background = new PIXI.Graphics()
				.beginFill(0x272735)
				.drawRoundedRect(CONFIG.BOARD.MAX_WIDTH - 80 - 249 + 60, 10, 249, 68, 60)
				.endFill();
			player2Background.zIndex = -2;
			this.avatarContainer.addChild(player2Background);

			this.avatarSprites[0].position.set(15, 15);
			this.avatarSprites[1].position.set(CONFIG.BOARD.MAX_WIDTH - 80, 15);
			// this.avatarSprites[0].filters = [new OutlineFilter(5, 0xffd828)];
			// this.avatarSprites[1].filters = [new OutlineFilter(5, 0x4b67a7)];
			const p = new PIXI.Graphics();
			p.beginFill(0x000000);
			p.lineStyle(0);
			p.drawCircle(CONFIG.BOARD.MAX_WIDTH - 49, 44, 29);
			p.drawCircle(44, 44, 29);
			p.endFill();
			this.avatarContainer.addChild(p);
			this.avatarSprites[0].mask = p;
			this.avatarSprites[1].mask = p;
			this.player1HP.position.set(115, 40);
			this.player2HP.position.set(CONFIG.BOARD.MAX_WIDTH - 170, 40);

			const player1Name = new PIXI.BitmapText(`${this.playerAvatars[0][2].split('').slice(0, 13).join('')}`,
				{
					fontName: "TitleFont",
					fontSize: 18,
					align: "right"
				});
			const player2Name = new PIXI.BitmapText(`${this.playerAvatars[1][2].split('').slice(0, 13).join('')}`,
				{
					fontName: "TitleFont",
					fontSize: 18,
					align: "right"
				});
			player1Name.position.set(110, 15);
			player2Name.anchor.set(1);
			player2Name.position.set(CONFIG.BOARD.MAX_WIDTH - 100, 35);
			this.avatarContainer.addChild(player1Name);
			this.avatarContainer.addChild(player2Name);
			this.avatarContainer.addChild(this.player2HP);
			this.avatarContainer.addChild(this.player1HP);

			this.player2HPBar = new PIXI.Graphics()
				.beginFill(0xFFFFFF)
				.drawRect(CONFIG.BOARD.MAX_WIDTH - 90, 40, 150, 20)
				.endFill();
			this.player2HPBar.tint = 0x0ec468;
			this.player2HPBar.zIndex = -1;
			this.player2HPBar.pivot.set(+this.player2HPBar.width, 0);
			this.avatarContainer.addChild(this.player2HPBar);
			this.player1HPBar = new PIXI.Graphics()
				.beginFill(0xFFFFFF)
				.drawRect(85, 40, 150, 20)
				.endFill();
			this.player1HPBar.tint = 0x0ec468;
			this.player1HPBar.zIndex = -1;
			this.player1HPBar.pivot.set(0);
			this.avatarContainer.addChild(this.player1HPBar);
			// this.avatarSprites[1].scale.set(0.35)
			// this.avatarSprites[0].scale.set(0.35)
			this.rightOutline = new PIXI.Graphics();
			this.rightOutline.beginFill(0xFFFFFF);
			this.rightOutline.lineStyle(0);
			this.rightOutline.drawCircle(CONFIG.BOARD.MAX_WIDTH - 49, 44, 34);
			this.rightOutline.endFill();
			this.rightOutline.tint = this.inactiveColor;
			this.rightOutline.zIndex = -1;
			this.avatarContainer.addChild(this.rightOutline);
			this.leftOutline = new PIXI.Graphics();
			this.leftOutline.beginFill(0xFFFFFF);
			this.leftOutline.lineStyle(0);
			this.leftOutline.drawCircle(44, 44, 34);
			this.leftOutline.endFill();
			this.leftOutline.tint = this.activeColor;
			this.leftOutline.zIndex = -2;
			this.avatarContainer.addChild(this.leftOutline);

		},
		redraw(map) {
			this.gemsMap = JSON.parse(JSON.stringify(this.level.board));
			this.gemsToInsert = [];
			for (let col = 0; col < this.gemsMap[0].length; col++) {
				this.gemsToInsert.push([]);
			}

		},
		populate() {
			let map = this.gemsMap;
			for (let line = map.length - 1; line >= 0; line--) {
				for (let col = map[line].length - 1; col >= 0; col--) {
					if (map[line][col] == 0) {
						//choose a gem by random
						let gemType = this.seed.pop();

						/**
						 * check if the new type will create a match
						 */
						let maxloops = 100;
						if (map[line].length - col > 2 && map.length - line > 2) {
							//check down and right matchs
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
								gemType = this.seed.pop(); /*Math.floor(Math.random() * (5) + 1)*/
								maxloops--;
							}
						} else if (map[line].length - col > 2 && map.length - line <= 2) {
							//check down match
							while (
								(
									(
										this.gemsMap[line][col + 1].type === this.gemsMap[line][col + 2].type
										&& this.gemsMap[line][col + 1].type === gemType
									)
								)
								&& maxloops > 0
								) {
								gemType = this.seed.pop(); /*Math.floor(Math.random() * (5) + 1)*/
								maxloops--;
							}
						} else if (map[line].length - col <= 2 && map.length - line > 2) {
							//check right match
							while (
								(
									(
										this.gemsMap[line + 1][col].type === this.gemsMap[line + 2][col].type
										&& this.gemsMap[line + 1][col].type === gemType
									)
								)
								&& maxloops > 0
								) {
								gemType = this.seed.pop(); /*Math.floor(Math.random() * (5) + 1)*/
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
				gemType = this.seed.pop();
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
			this.validMove = true;
			this.eventIsDown = true;
			this.eventStartPoint = event.data.getLocalPosition(this.gemContainer);
			//reset Combo
			// this.comboCount = 0;
		},
		pointermove(event) {
			// console.log('start pointer move')
			if (!this.eventIsDown || this.gemSelected != null /*|| залочить this.manager.lockEvents*/) {
				// console.log('return 2')
				return;
			}
			let pointNow = event.data.getLocalPosition(this.gemContainer);
			//get gemAddress in array map
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
				// this.interactive = false
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
				let pointNow = event.data.getLocalPosition(this.gemContainer);
				let nowAddress = {
					line: Math.floor(pointNow.y / 61),
					col: Math.floor(pointNow.x / 61)
				};
				if (firstAddress.line == nowAddress.line && firstAddress.col == nowAddress.col) {
					//select the gem
					this.gemSelected = firstAddress;
				}
			} else {
				let pointNow = event.data.getLocalPosition(this.gemContainer);
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
						this.insertGemSwap(this.gemSelected, {line: 0, col: -1}, this.player.userId !== this.currentMoverId);
					} else if (nowAddress.line == this.gemSelected.line && this.gemSelected.col + 1 == nowAddress.col) {
						//right
						this.makingMove = true;
						this.insertGemSwap(this.gemSelected, {line: 0, col: 1}, this.player.userId !== this.currentMoverId);
					} else if (nowAddress.line == this.gemSelected.line - 1 && this.gemSelected.col == nowAddress.col) {
						//top
						this.makingMove = true;
						this.insertGemSwap(this.gemSelected, {line: -1, col: 0}, this.player.userId !== this.currentMoverId);
					} else if (nowAddress.line == this.gemSelected.line + 1 && this.gemSelected.col == nowAddress.col) {
						//bottom
						this.makingMove = true;
						this.insertGemSwap(this.gemSelected, {line: 1, col: 0}, this.player.userId !== this.currentMoverId);
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

				/**
				 * Insert gem?s swap
				 */
					//check the target position and check it if exist
				let tempGem = this.gemsMap[newAdress.line][newAdress.col];
				if (tempGem === -1) {
					return;
				}
				// this.manager.decreaseMoves()
				this.gemsMap[newAdress.line][newAdress.col] = this.gemsMap[address.line][address.col];
				this.gemsMap[address.line][address.col] = tempGem;

				this.gemsAreMoving = true;
				this.gemsMap[address.line][address.col].addMovement(address.col * 61, address.line * 61);
				this.gemsMap[newAdress.line][newAdress.col].addMovement(newAdress.col * 61, newAdress.line * 61);


				this.gemsSwapping.push(newAdress);
				this.gemsSwapping.push(address);
				if (!opponentsTurn && this.makingMove) {
					if (this.volume) {
						PIXISound.play('gemMovement');
					}
					this.$socket.emit('playTile', this.player.userId, address, movement);
					this.makingMove = false;
				}
			} catch (e) {
				console.log(e);
				console.log(address);
				console.log(movement);
				console.log(this.gemsMap);
			}

		},
		reverseGemsSwap() {
			if (this.gemsSwapping.length === 0) {
				return;
			}

			// this.manager.increaseMoves()
			let gems = this.gemsSwapping;

			let tempGem = this.gemsMap[gems[0].line][gems[0].col];

			//reverse positions
			this.gemsMap[gems[0].line][gems[0].col] = this.gemsMap[gems[1].line][gems[1].col];
			this.gemsMap[gems[1].line][gems[1].col] = tempGem;

			//insert movements
			this.gemsAreMoving = true;
			this.gemsMap[gems[0].line][gems[0].col].addMovement(gems[0].col * 61, gems[0].line * 61, true);
			this.gemsMap[gems[1].line][gems[1].col].addMovement(gems[1].col * 61, gems[1].line * 61, true);

			//reset gemsSwapping to prevent reverse again
			this.gemsSwapping = [];

		},
		finishGemsSwap() {
			this.gemsSwapping = [];
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
		convertTypeToScore(gemType) {
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
						//reset letiables
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
				//and reset too
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
						//reset letiables
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
				//and reset too
				lastType = 0;
				lastSameGemsType = [];
			}

			/**
			 * explode the gems listed
			 */


			if (gemsToExplode.length > 0) {
				for (let i = 0; i < gemsToExplode.length; i++) {
					let gemAddress = gemsToExplode[i];
					map[gemAddress.line][gemAddress.col].insertExplosion(gemAddress);

				}
				this.hasAnimation = true;
				if (this.currentMoverId === this.player.userId) {
					if (gemsToExplode.length > 4
						&& (gemsToExplode.every((el) => gemsToExplode[0].col === el.col)
							|| gemsToExplode.every((el) => gemsToExplode[0].row === el.row))) {
						this.tntAvailable = true;
					} else if (gemsToExplode.length > 3
						&& (gemsToExplode.every((el) => gemsToExplode[0].col === el.col)
							|| gemsToExplode.every((el) => gemsToExplode[0].row === el.row))) {
						this.dynamiteAvailable = true;
					}
					this.gemsPopped = true;
				}

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
				this.app.view.width,
				this.app.view.height
			);
		},

		resetState() {
			if (this.app) {
				this.app.destroy(true);
			}

			this.app = null;

			if (this.$refs.game) {
				this.$refs.game.innerHTML = null;
			}

			this.players = {};
			this.player = null;

			this.setRoomState(this.gameStatuses.init);
		},
		dynamiteAvailability(dynamiteAvailable) {
			if (!this.dynamiteSprite) return;
			if (dynamiteAvailable) {
				this.dynamiteSprite.alpha = 1;
				this.dynamiteSprite.buttonMode = true;
				this.dynamiteSprite.interactive = true;
			} else {
				this.dynamiteSprite.alpha = 0.5;
				this.dynamiteSprite.buttonMode = false;
				this.dynamiteSprite.interactive = false;
			}
		},
		tntAvailability(tntAvailable) {
			if (!this.tntSprite) return;
			if (tntAvailable) {
				this.tntSprite.alpha = 1;
				this.tntSprite.buttonMode = true;
				this.tntSprite.interactive = true;
			} else {
				this.tntSprite.alpha = 0.5;
				this.tntSprite.buttonMode = false;
				this.tntSprite.interactive = false;
			}
		},
// setInteractivity(value) {
// 	this.gemContainer.interactive = value;
// 	this.gemContainer.buttonMode = value;
// },
		roomInPlay,
		roomInWait,
	},


	watch: {
		activePlayerId(current) {
			this.setCurrentPlayer(this.players[0].userId === current ? this.players[0] : this.players[1]);
		},
		validMove(cur) {
		},
		hasAnimation(current) {
		},
		interactive(current) {
			if (this.gemContainer) {
				this.gemContainer.interactive = current;
				this.gemContainer.buttonMode = current;
			}
		},
		currentMoverId(current, previous) {
			// if (!previous) {
			if (this.interactive) {
				this.tntAvailability(this.tntAvailable);
				this.dynamiteAvailability(this.dynamiteAvailable);
			} else {
				this.tntAvailability(false);
				this.dynamiteAvailability(false);
			}
			setTimeout(() => {
				this.setCurrentPlayer(this.players[0].userId === current ? this.players[0] : this.players[1]);
				if (this.leftOutline) {
					if (+current === +this.playerIds[0]) {
						this.leftOutline.tint = this.activeColor;
						this.rightOutline.tint = this.inactiveColor;
					} else {
						this.rightOutline.tint = this.activeColor;
						this.leftOutline.tint = this.inactiveColor;
					}
				}
			}, 600);
			// }
		},
		// seed(current) {
		// }
		gemsAreMoving(current) {
			if (current || this.hasAnimation) {
				this.interactive = false;
			} else {

				if (this.robotId && this.robotId === this.currentMoverId && this.gemsPopped) {
					const score = {
						damage: this.currentDamage,
						heal: this.currentHeal
					};
					this.$socket.emit('handRefresh', this.robotId, true, score, this.robotId);
					this.gemsPopped = false;
					this.validMove = false;
				} else if (this.player.userId === this.currentMoverId && this.gemsPopped) {
					const score = {
						damage: this.currentDamage,
						heal: this.currentHeal
					};
					this.$socket.emit('handRefresh', this.player.userId, this.validMove, score);
					this.gemsPopped = false;
					this.validMove = false;
				}
			}
			this.interactive = this.player.userId === this.currentMoverId;
		}
	}
}
;

</script>

<style lang="scss" src="./../scss/game.scss">
</style>
