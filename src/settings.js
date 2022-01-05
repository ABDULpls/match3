const widgets = {
	left: [],
	right: ['ModulePlayers'],
	bottom: ['ModuleChat'],
};

const fake = {
	scoreMin: 1,
	scoreMax: 16,
	upScoreMin: 1,
	upScoreMax: 2,
	playTimeMin: 3 * 60 * 1000,
	playTimeMax: 10 * 60 * 1000,
};
module.exports = {
	fake,
	widgets,
};
