(function(){

var conf = require('./conf.json').production,
	exec = require('child_process').exec,
	Q = require('q');

function apiCall(command){
	var def = Q.defer();
	
	exec('php app/console '+command, 
		{cwd: conf.path}, 
		function(error, stdout, stderr){
			if (error) def.reject(error);
			else{
				def.resolve(stdout.replace(/(\r)?\n$/, ''));
			}
	});
	
	return def.promise;
}

function getBattleIdByToken(token){
	var def = Q.defer();
	
	apiCall('api:battle:get '+token.toString()).then(function(id){
		def.resolve(parseInt(id));
	}, def.reject);
	
	return def.promise;
}

function endBattle(battleId){
	var def = Q.defer();
	
	apiCall('api:battle:end '+battleId.toString()).then(function(result){
		if (!!result) def.resolve();
		else def.reject();
	}, def.reject);
	
	return def.promise;
}

exports.getBattleIdByToken = getBattleIdByToken;
exports.endBattle = endBattle;

})();