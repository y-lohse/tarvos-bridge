(function(){

//Manages a list of all active battles
//only does the instanciating and retrieving part, every thing else should be done by another module
var TarvosEngine = require('tarvos-battle'),
	API = require('./API.js'),
	Q = require('q');

var battles = [];

//returns the battle for a token (creates it if necessary). Returns null if the token is nowhere to be found
function getBattleByToken(token){
	winston.info('Searching battle for token %s', token);
	var def = Q.defer();
	var tokenBattle = null;
	
	API.getBattleId(token)
	.then(function(battleId){
		winston.info('Looking for battle id %s', battleId);
		//first check to see if the battle is already created
		battles.every(function(battle){
			if (battle.engine.id == battleId){
				def.resolve(battle);
				return false;
			}
			else{
				return true;
			}
		});
		
		//if it wasnt existing; create it
		if (!def.promise.isFulfilled()){
			winston.info('Starting new engine instance for battle %s', battleId);
			var engine = new TarvosEngine(battleId);
			tokenBattle = {
				engine: engine,
				clients: [],
				setup: false
			};
			
			battles.push(tokenBattle);
			def.resolve(tokenBattle);
		}
	},
	def.reject);
	
	return def.promise;
}

function endBattle(battle){
	var winner = (battle.clients[0].player.hp.current > 0) ? battle.clients[0].token : battle.clients[1].token;
	
	//@TODO: pass a clean client object, not the whole array
	return API.endBattle(battle.engine.id, battle.clients, winner);
}

exports.getBattleByToken = getBattleByToken;
exports.endBattle = endBattle;

})();