(function(){	

var WebSocketServer = require('ws').Server,
	server = new WebSocketServer({port: 8080});
var BattleIndex = require('./BattleIndex.js'),
	API = require('./API.js');

console.log('Server started');

/**
 * Permet d'envoyer un message aux joueurs de la bataille
 */
function battleBroadcast(battle, data){
	battle.clients.forEach(function(client){
		client.socket.send(JSON.stringify(data), function(err){
			if (err) console.log('error while battle-broadcasting');
		});
	});
}

function battleSetup(battle){
	//start liste,ers for battle events
	battle.engine.on('players:update', function(players){
		battleBroadcast(battle, {
			type: 'players',
			players: players
		});
	});

    battle.engine.on('battle:end', function(){
        BattleIndex.endBattle(battle).then(function(){
			battleBroadcast(battle, {
				type: 'battle-end',
			});
        });
    });
	
	battle.setup = true;
}

function clientSetup(battle, client){
	client.socket.on('close', function(){
		battle.clients.every(function(battleClient, index){
			if (client.socket === battleClient.socket){
				battle.clients.splice(index, 1);
				battle.engine.pushTask(battle.engine.removePlayer, battleClient.player);
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
				battle.engine.pushTask(battle.engine.attackPlayer, client.player, data.target, data.armament);
				break;
		}
	});
	
	//creates the player inside the battle
	API.getShip(client.token)
	.then(function(data){
		return battle.engine.pushTask(battle.engine.addPlayer, data.name, data.hp, data.armaments);
	})
	.then(function(player){
		//assign the reference to the actual player object
		battle.clients[battle.clients.length-1].player = player;
		
		client.socket.send(JSON.stringify({
			type: 'identity',
			id: player.id
		}));
	});
}

//waits for a client to send a register message
function clientRegisterListener(data){
	var data = JSON.parse(data);
	
	if (data.type == 'register'){
		var token = data.token;
		
		BattleIndex.getBattleByToken(token)
		.then(
		(function(battle){
			//create client tracking object
			var client = {
				socket: this,
				token: token,
				player: null
			};
			battle.clients.push(client);
			
			if (!battle.setup) battleSetup(battle);
			
			clientSetup(battle, client);
			this.removeListener('message', clientRegisterListener);//client is registered, we don't need this anymore
		}).bind(this),
		function(){
			console.log('Token %s has no battle associated to it', token);
			//@TODO: drop la connexion ou quelque chose?
		});
	}
}

server.on('connection', function(ws){
	console.log('New connection');
	ws.on('message', clientRegisterListener);
});

})();