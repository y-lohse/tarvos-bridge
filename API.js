(function(){

var useConf = 'production'
process.argv.forEach(function(value, index){
	if (index > 1 && value.match(/conf=\w+/)){
		useConf = value.split('=')[1];
	}
});

var conf = require('./conf.json')[useConf],
	exec = require('child_process').exec,
	Q = require('q');

function apiCall(command){
	var def = Q.defer();
	
	exec('php app/console '+command, 
		{cwd: conf.path}, 
		function(error, stdout, stderr){
			if (error || stderr){
				console.log('Error during api call: %s', (error || stderr));
                console.log(command);
				def.reject(error);
			}
			else{
				console.log(command+' returned '+stdout);
				def.resolve(stdout.replace(/(\r)?\n$/, ''));
			}
	});
	
	return def.promise;
}

function getBattleId(token){
	var def = Q.defer();

	apiCall('api:battle:get '+token.toString()).then(function(id){
        var id = parseInt(id);
		if (id > 0) def.resolve(id);
        else def.reject(id);
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
			ship: {hp: client.player.hp.current}
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