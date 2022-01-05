import Gem from "./Gem";
import * as PIXI from "pixi.js-legacy";

export default function GemPool(board_,gemTextures) {
	this.board = board_;
	this.gems = {
		1: [],
		2: [],
		3: [],
		4: [],
		5: [],
		6: []
	};
	// this.gemTextures = [];
	// this.loader = new PIXI.Loader();
	// this.loader
	// 	.add("sprites", "https://gamezz.io/games/match3/sprites.json")
	// 	.load((_, resources) => {
	// 		for (let i = 0; i < Object.keys(this.loader.resources.sprites.textures).length; i++) {
	// 			this.gemTextures.push(Object.values(this.loader.resources.sprites.textures)[i]);
	// 		}
			for (let i = 0; i < 40; i++) {
				this.addGem(1, i, gemTextures[0]);
				this.addGem(2, i, gemTextures[1]);
				this.addGem(3, i, gemTextures[2]);
				this.addGem(4, i, gemTextures[3]);
				this.addGem(5, i, gemTextures[4]);
				this.addGem(6, i, gemTextures[5]);
			}
		// });
}
GemPool.prototype.addGem = function(type, id, texture) {
	let gem = new Gem(type, id, this.board, texture);
	this.gems[type].push(gem);
};

GemPool.prototype.borrow = function(type) {
	return this.gems[type].shift();
};
GemPool.prototype.return = function(gem) {
	this.gems[gem.type].push(gem);
};
