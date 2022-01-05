const _keys = require('lodash/keys');
const _pickBy = require('lodash/pickBy');
const _shuffle = require('lodash/shuffle');
const _forEach = require('lodash/forEach');
const _findIndex = require('lodash/findIndex');
const _cloneDeep = require('lodash/cloneDeep');
const Player = require('./Player');
const CONFIG = require('./config');

module.exports = class Game {

    constructor() {
        this.players = {};
        this.userIds = [];
        this.losers = [];
        this.isFirstMove = true;
        this.timerId = null;
        this.timesRestarted = 0;
        this.bazaar = [];
    }

    init() {
        if (this.isFirstMove) {
            this.userIds = _shuffle(Object.keys(this.players).map(el => +el));
        }
        return this.userIds[0];
    }

    getPlayerById(userId) {
        return this.players[userId];
    }

    addPlayer(userId, isRobot = 0) {
        const player = new Player(userId, isRobot);
        this.players[userId] = player;

        return player;
    }

    removePlayer(userId, hardDelete = false) {
        if (!this.players[userId]) {
            return false;
        }
        if (hardDelete && this.queue) {
            this.queue = this.queue.filter(id => id !== userId);
        } else {
            const index = _findIndex(this.losers, loser => loser.userId === userId);
            if (index < 0) {
                this.losers.push(this.players[userId]);
            }
        }
    }

    getCountPlayersInGame() {
        return _keys(_pickBy(this.players, player => !player.isLeft() && player.isOnline)).length;
    }
};












