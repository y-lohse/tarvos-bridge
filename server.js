(function(){	

var WebSocketServer = require('ws').Server,
	server = new WebSocketServer({port: 8080});
var BattleIndex = require('./BattleIndex.js'),
	API = require('./API.js');

console.log('Socket started');

//sends data to a single client
function sendJSON(client, data){
	client.socket.send(JSON.stringify(data), function(err){
		if (err) console.log('error while sending data to client');
	});
}

/**
 * Permet d'envoyer un message aux joueurs de la bataille
 */
function battleBroadcast(battle, data){
	battle.clients.forEach(function(client){
		sendJSON(client, data);
	});
}

function battleSetup(battle){
	//start liste,ers for battle events
	console.log('Performing battle setup');
	
	battle.engine.on('players:update', function(players){
		battleBroadcast(battle, {
			type: 'players',
			players: players
		});
	});
	
	battle.engine.on('players:hp', function(hps){
		battleBroadcast(battle, {
			type: 'hp',
			hps: hps
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
	console.log('Performing client setup');
	
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
				battle.engine.pushTask(battle.engine.attackPlayer, client.player, data.target, data.armament, data.room);
				break;
            case 'powerup':
                battle.engine.pushTask(battle.engine.powerUp, client.player, data.module);
                break;
            case 'powerdown':
                battle.engine.pushTask(battle.engine.powerDown, client.player, data.module);
                break;
		}
	});
	
	//creates the player inside the battle
	API.getShip(client.token)
	.then(function(data){
		return battle.engine.pushTask(battle.engine.addPlayer, data.name, data.hp, data.armaments, data.type, data.energy, data.modules);
	})
	.then(function(player){
		//assign the reference to the actual player object
		client.player = player;
		
		player.on('armament:broken', function(armamentId){
			sendJSON(client, {
				type: 'armament-broken',
				id: armamentId
			});
		});
		
		player.on('module:state', function(moduleId, state){
			sendJSON(client, {
				type: 'module-state',
				id: moduleId,
				state: state
			});
		});
		
		console.log('Client setup complete');
		
		sendJSON(client, {
			type: 'identity',
			id: player.id
		});
	});
}

//waits for a client to send a register message
function clientRegisterListener(data){
	var data = JSON.parse(data);
	
	if (data.type == 'register'){
		var token = data.token;
		console.log('Received token %s', token);
		
		BattleIndex.getBattleByToken(token)
		.then(
		(function(battle){
			console.log('Battle '+battle.engine.id+' linked to token '+token);
			console.log('%d clients already in that battle', battle.clients.length);
			
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
		(function(){
			console.log('Token %s has no battle associated to it', token);
			console.log('Dropping client.');
			this.close();
		}).bind(this));
	}
	else{
		console.log('Client sent data prior to handshake');
		console.log(data);
	}
}

server.on('connection', function(ws){
	console.log('New connection');
	ws.on('message', clientRegisterListener);
});

})();