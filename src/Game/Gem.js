import * as PIXI from "pixi.js-legacy";
import {GlowFilter} from "pixi-filters";
import {BevelFilter} from "pixi-filters";

export default function Gem(type_, id_, board_, texture) {
	PIXI.Container.call(this);

	this.id = id_;
	this.type = type_;
	this.board = board_;
	this.updateSpeed = 0.5; // скорость перемещения гемов
	this.idName = "gem" + type_ + "-" + id_;
	this.newPosition = [];
	this.myAddress = {
		line: 0,
		col: 0
	};

	this.gemObj = new PIXI.Sprite(texture);
	// this.filters = [ new BevelFilter()]
	this.addChild(this.gemObj);
}
Gem.prototype = Object.create(PIXI.Container.prototype);

Gem.prototype.update = function() {

	// здесь тикер двигает гемы
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
			return this.newPosition.shift();
		}
		return true;
	} else {
		return false;
	}
};
Gem.prototype.addMovement = function(x_, y_, reverse = false) {
	this.newPosition.push({
		x: x_,
		y: y_
	});
	// костыль из-за бага с летающими гемами
	// if (this.newPosition.length > 1 && !reverse) {
	// 	this.newPosition = this.newPosition.splice(-1, 1);
	// }
};

Gem.prototype.insertExplosion = function(myAddress_,) {
	const gemTicker = new PIXI.Ticker;
	gemTicker.add(this.animateExplosion(gemTicker, myAddress_));
	gemTicker.start();
};

Gem.prototype.animateExplosion = function(ticker, myAddress_) {
	this.filters = [new GlowFilter({
		outerStrength: 3,
	})];
	return () => {
		if (this.filters[0])
			this.filters[0].outerStrength -= 0.08;
		this.alpha -= 0.03;
		if (this.alpha <= 0) {
			this.finishExplosion(myAddress_);
			// this.board.addGemsToBoard()
			ticker.destroy();
			this.filters = [];
		}
	};
};
Gem.prototype.finishExplosion = function(myAddress_,) {
	setTimeout(() => {
	this.setAddress(myAddress_);
	this.board.endAnimation();
		this.board.removeGem(myAddress_);
		this.alpha = 1;
	}, 16);
};

Gem.prototype.setAddress = function(newAddress) {
	this.myAddress = newAddress;

};

Gem.prototype.refresh = function() {
	// this.background.alpha = 0;
};

