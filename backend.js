const GameModule = require("../Game");
const Game = require("./src/Game");

const _forIn = require("lodash/forIn");
const CONFIG = require("./src/config");

class Match3 extends GameModule {
	options = {};
	moverId = null;
	nextId = null;
	firstPlayerId = null;
	fistPlayerTile = null;
	firstTileIndex = null;
	player1HP = CONFIG.LEVEL.HP;
	player2HP = CONFIG.LEVEL.HP;
	playerAvatars = [];
	prevTile = null;
	level = CONFIG.LEVEL.board;
	gemsToInsert = [];
	playerIds = [];

	constructor() {
		super();
	}

	initGame(io, roomId, options, gameEvents) {
		super.initGame(io, roomId, options, gameEvents);
		this.options = Object.assign({}, options);
		// this.options.playWith = 2
		this.options.scoreType = 'none'
		this.turnTimer = new this.timer(io, roomId, options);
		this.game = new Game();
	}

	joinPlayer(user) {
		let player = this.game.getPlayerById(user.userId);
		if (!player) {
			player = this.game.addPlayer(user.userId, user.isRobot);
		}

		player.setOnline();
		player.setSocket(user.id);

		this.players = this.game.players;
		this.playerIds = Object.keys(this.players);
	}

	onPlayTile(index, side, gemsToExplode) {
		this.callbacks.playTile(this.io, this.user.userId, this.roomId, {
			index,
			side,
			gemsToExplode
		});
	}

	onHandRefresh(userId,valid, score, robotId) {
		this.callbacks.handRefresh(this.io, this.user.userId, this.roomId, {
			userId,
			valid,
			score,
			robotId
		});
	}

	initPlayer(io, socket, user, roomId, options, callbacks) {
		super.initPlayer(io, socket, user, roomId, options, callbacks);

		if (!user.isRobot) {
			this.handlers = {
				playTile: this.onPlayTile.bind(this),
				disconnect: this.onDisconnect.bind(this),
				handRefresh: this.onHandRefresh.bind(this),
				// leaveRoom: this.onLeaveRoom.bind(this),

			};

			for (let eventName in this.handlers) {
				if (this.handlers.hasOwnProperty(eventName)) {
					this.socket.on(eventName, this.handlers[eventName]);
				}
			}
		}

		return new Promise((resolve, reject) => {
			this.getGameData()
				.then(gameData => {
					socket.emit("initGame", {
						options: gameData.options,
						player: gameData.player
					});

					resolve();
				})
				.catch(error => {
					reject(error);
				});
		});
	}

	onGameStart({players, forPlayer}) {
		this.players = this.game.players;
		this.game.started = true;
		players.forEach(player => {
			player = Object.assign(player, this.players[player.userId]);
		});
		if (this.activePlayersInRoom)
			this.game.timerId = this.turnTimer.start(this.onNextPlayerTurn.bind(this), this.game.timerId);
		this.moverId = this.game.init();
		const firstPlayer = Object.keys(this.players)[Math.round(Math.random())]
		// console.log('first = ' + firstPlayer)
		this.moverId = +firstPlayer
		let seed = []
		for (let i = 0; i < 1000; i++) {
			seed.push(Math.floor(Math.random() * (6) + 1))
		}

		super.onGameStart({players, forPlayer});
		this.game.score = null;
		this.io.to(this.roomId).emit("initSeed", seed, +firstPlayer);
		this.game.timerId = this.turnTimer.restart(this.onNextPlayerTurn.bind(this), this.game.timerId);

		// _forIn(players, player => {
		// 	this.io.to(player.socketId).emit("newRound", {
		// 		userId: player.userId,
		// 		table: this.table,
		// 		movesLeft: this.game.movesLeft(this.table)
		// 	});
		// });
	}
	nodeGetGameData(userId) {
		return {
			options: this.options,
			player: this.players[userId]
		};
	}


	onDisconnect() {
		this.activePlayersInRoom--;
		this.closeGameListeners();
	}
	nextMover(currId, playerIds) {
		let nextId;
			let currentIndex = playerIds.indexOf(currId.toString());
			if (currentIndex + 1 < playerIds.length) {
				nextId = playerIds[currentIndex + 1];
			} else {
				nextId = playerIds[0];
			}
		return nextId;
	}
	nodeHandRefresh(userId, {valid, score, robotId}) {
		// console.log('==========!!!!!!!!!!!!!!!!!!!============');
		if (!valid) {
			// console.log('invalid move');
			return;
		}
		if (robotId)
			userId = robotId
		// console.log('move by '  + userId);
		this.moverId = this.nextMover(userId, Object.keys(this.players))
		// console.log('new mover: ' + this.moverId);
		// console.log('HEEL: ' +score.heal);
		// console.log('DMG: ' +score.damage);
		if (Object.keys(this.players)[0] === userId.toString() ) {
			this.player2HP -= score.damage
			this.player1HP += score.heal
			if (this.player2HP < 1) {
				// console.log('upper < 1');
				this.player2HP = 0
				this.players[userId].score = 1 /*this.player1HP*/
				this.players[Object.keys(this.players)[1]].score = 0 /*this.player2HP*/
				this.updateScores();
				this.onGameOver()
			}
			if (this.player1HP > 150)
				this.player1HP = 150
		} else {
			this.player1HP -= score.damage
			this.player2HP += score.heal
			if (this.player1HP < 1) {
				// console.log('lower < 1');
				this.player1HP = 0
				this.players[Object.keys(this.players)[1]].score = 1 /*this.player2HP*/
				this.players[userId].score =0 /*this.player1HP*/
				this.updateScores();
				this.onGameOver()
			}
			if (this.player2HP > 150)
				this.player2HP = 150
		}
		// console.log(this.players[Object.keys(this.players)[0]].score);
		// console.log(this.players[Object.keys(this.players)[1]].score);
		// console.log(this.moverId);
		this.game.timerId = this.turnTimer.restart(this.onNextPlayerTurn.bind(this), this.game.timerId);
		this.io.to(this.roomId).emit("moverChange", this.moverId, this.player1HP, this.player2HP);
	}
	nodeRemovePlayer(userId, hardDelete) {
		this.game.removePlayer(userId, hardDelete);
		super.nodeRemovePlayer(userId, hardDelete);
		const onlinePlayers = Object.keys(this.players).map(userId => this.players[userId]).filter(player => player.isOnline);
		this.onGameOver();
	}

	onGameOver() {
		if (this.game) {
			this.players = this.game.players;
			Object.keys(this.players).forEach(playerId => {
				this.nodePlayerGameOver(playerId);
			});

			super.onGameOver();
		}
	}

	updateLog(userId, roomId) {
		const log = {
			userId: userId,
			passTurn: false
		};

		super.updateLog(roomId, log);
	}

	updateScores() {
		this.players = this.game.players;
		this.sendScores();
	}

	nodePlayTile(userId, {index, side, gemsToExplode}) {
		try {
			// console.log(side,gemsToExplode);
			for (const player in this.players) {
				if (+player !== userId) {
					this.io.to(this.players[player].socketId).emit("initMove", this.moverId, side, gemsToExplode);

				}
			}
			// let nextTile;
			// for (let i = 0; i < this.table.length; i++) {
			//     if (this.table[i].value[1] === index) {
			//         nextTile = this.table[i];
			//     }
			// }
			// let removeTile = false;
			// if (this.prevTile && nextTile &&
			//     !this.game.isBlocked(this.prevTile, this.table) && !this.game.isBlocked(nextTile, this.table)
			//     && this.prevTile.value && nextTile.value[0] === this.prevTile.value[0]
			//     && nextTile.value[1] !== this.prevTile.value[1]) {
			//     this.table[this.table.indexOf(nextTile)].isGone = true;
			//     this.table[this.table.indexOf(this.prevTile)].isGone = true;
			//     removeTile = true;
			//     this.prevTile = null;
			//     nextTile = null;
			//     const tilesLeft = this.table.filter(value => !value.isGone).length;
			//     const removing = {
			//         removeTile: removeTile,
			//         movesLeft: this.game.movesLeft(this.table),
			//         tilesLeft
			//     }
			//     _forIn(this.players, player => {
			//         this.io.to(player.socketId).emit("removeTile", removing);
			//     });
			//     if (tilesLeft === 0 || this.game.movesLeft(this.table) === 0) {
			//         this.updateScores();
			//         this.onGameOver();
			//     }
			//
			// }
			// this.prevTile = nextTile;
		} catch (e) {
			console.log(e);
		}
	}

}

module.exports.Game = Match3;
