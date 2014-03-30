(function(){

var conf = require('./conf.json').production,
	exec = require('child_process').exec,
	Q = require('q');

function apiCall(command){
	var def = Q.defer();
	
	exec('php app/console '+command, 
		{cwd: conf.path}, 
		function(error, stdout, stderr){
			if (error){
				console.log(error);
				def.reject(error);
			}
			else{
				def.resolve(stdout.replace(/(\r)?\n$/, ''));
			}
	});
	
	return def.promise;
}

function getBattleId(token){
	var def = Q.defer();
	
	apiCall('api:battle:get '+token.toString()).then(function(id){
		def.resolve(parseInt(id));
	}, def.reject);
	
	return def.promise;
}

function endBattle(battleId, clients, winner){
	var def = Q.defer();
	
	var data = {
		battle: {
			id: battleId,
			winner: winner
		}
	};
	
	clients.forEach(function(client){
		data.battle[client.token] = {
			ship: {hp: client.player.hp}
		};
	});
	
	var args = JSON.stringify(data).replace(/"/g, "\\\"");
	
	apiCall('api:battle:end '+args).then(function(result){
		if (!!result) def.resolve();
		else def.reject();
	}, def.reject);
	
	return def.promise;
}

function getShip(token){
	var def = Q.defer();
	
	apiCall('api:ship:get '+token.toString()).then(function(result){
		if (result == 0) def.reject();
		else{
			def.resolve(JSON.parse(result));
		}
	}, def.reject);
	
	return def.promise;
}

exports.getBattleId = getBattleId;
exports.endBattle = endBattle;
exports.getShip = getShip;

})();