(function(){	

var WebSocketServer = require('ws').Server,
	server = new WebSocketServer({port: 8080});
var BattleIndex = require('./BattleIndex.js');

console.log('Server started');

function clientRegisterListener(data){
	var data = JSON.parse(data);
	
	if (data.type == 'register'){
		var token = data.token;
		
		var promise = BattleIndex.getBattleByToken(token);
		promise.then(
		(function(battle){
			var client = {
				socket: this,
				token: token,
				player: null
			};
			battle.clients.push(client);
			
			if (!battle.setup) battleSetup(battle);
			
			clientSetup(battle, client);
			this.removeListener('message', clientRegisterListener);
		}).bind(this),
		function(){
			console.log('Token '+token+' has no battle associated to it');
			//@TODO: drop la connexion ou queuqlue chose?
		});
	}
}

server.on('connection', function(ws){
	console.log('New connection');
	ws.on('message', clientRegisterListener);
});

function battleSetup(battle){
	battle.engine.on('players:update', function(players){
		battleBroadcast(battle, JSON.stringify({
			type: 'players',
			players: players
		}));
	});
	
	battle.setup = true;
}

function clientSetup(battle, client){
	client.socket.on('close', function(){
		battle.clients.every(function(battleClient, index){
			if (client.socket === battleClient.socket){
				battle.clients.splice(index, 1);
				battle.engine.pushTask(battle.engine.removePlayer, [battleClient.player]);
				return false;
			}
			else{
				return true;
			}
		});
	});
	
	client.socket.on('message', function(data){	
		data = JSON.parse(data);
		switch (data.type){
			case 'attack':
				battle.engine.pushTask(battle.engine.attackPlayer, [data.target]);
				break;
		}
	});
	
	//creates the player inside the battle
	battle.engine.pushTask(battle.engine.addPlayer)
	.then(function(player){
		battle.clients[battle.clients.length-1].player = player;
		
		client.socket.send(JSON.stringify({
			type: 'identity',
			id: player.id
		}));
	});
}

function battleBroadcast(battle, message){
	battle.clients.forEach(function(client){
		client.socket.send(message, function(err){
			if (err) console.log('error while battle-broadcasting');
		});
	});
}

})();