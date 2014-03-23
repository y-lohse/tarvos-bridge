(function(){

var TarvosEngine = require('tarvos-battle'),
	Database = require('./Database.js'),
	Q = require('q');

var battles = [];

//returns the battle for atoken (creates it if necessary). Returns null if the token is nowhere to be found
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
		Database.open();
		
		Database.getBattleIdByToken(token)
		.then(function(battleId){
			Database.close();
			
			var engine = new TarvosEngine(battleId);
			tokenBattle = {
				engine: engine,
				clients: [],
				setup: false
			};
			
			battles.push(tokenBattle);
			def.resolve(tokenBattle);
		},
		function(){
			Database.close();
			def.reject();
		});
	}
	
	return def.promise;
}

exports.getBattleByToken = getBattleByToken;

})();