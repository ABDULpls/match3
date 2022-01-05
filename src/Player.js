const BasePlayer = require('../../Player');

module.exports = class Player extends BasePlayer {
    constructor(userId, type = 0) {
        super(userId, type);

        this.setup();
    }

    setup() {

    }

    setOnline(online = true) {
        this.isOnline = online;
    }

    setSocket(socketId) {
        this.socketId = socketId;
    }

    canPlay() {
        return !this.isLeft();
    }

    reset() {
        super.reset();
    }
};
