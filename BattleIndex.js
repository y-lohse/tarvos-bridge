(function(){

//Manages a list of all active battles
//only does the instanciating and retrieving part, every thing else should be done by another module
var TarvosEngine = require('tarvos-battle'),
	API = require('./API.js'),
	Q = require('q');

var battles = [];

//returns the battle for a token (creates it if necessary). Returns null if the token is nowhere to be found
function getBattleByToken(token){
	var def = Q.defer();
	
	var tokenBattle = null;
	var found = false;//used to early out
	
	battles.every(function(battle){
		battle.clients.every(function(client){
			if (client.token === token){
				found = true;
				tokenBattle = battle;
			}
			
			return !found;
		});
		
		return !found;
	});
	
	if (found){
		def.resolve(tokenBattle);
	}
	else{
		//unknown token, check in database
		API.getBattleId(token)
		.then(function(battleId){
			var engine = new TarvosEngine(battleId);
			tokenBattle = {
				engine: engine,
				clients: [],
				setup: false
			};
			
			battles.push(tokenBattle);
			def.resolve(tokenBattle);
		},
		function(error){
			def.reject();
		});
	}
	
	return def.promise;
}

function endBattle(battle){
	return API.endBattle(battle.engine.id);
}

exports.getBattleByToken = getBattleByToken;
exports.endBattle = endBattle;

})();