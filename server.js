(function(){	

var WebSocketServer = require('ws').Server,
	server = new WebSocketServer({port: 8080});
var BattleIndex = require('./BattleIndex.js'),
	API = require('./API.js'),
    inactivity = require('./conf.json')[inactivity];

console.log('Socket started');

//sends data to a single client
function sendJSON(client, data){
    if(client.socket != null) {
        client.socket.send(JSON.stringify(data), function(err){
            if (err) console.log('error while sending data to client');
        });
    }
}

/**
 * Permet d'envoyer un message aux joueurs de la bataille
 */
function battleBroadcast(battle, data){
	battle.clients.forEach(function(client){
        if(client.socket != null) {
		    sendJSON(client, data);
        }
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
        battle.engine.stop();
        BattleIndex.endBattle(battle).then(function(){
			battleBroadcast(battle, {
				type: 'battle-end'
			});
        });
    });
	
	battle.setup = true;
}

function clientTimeout(client,battle) {
    clearTimeout(client.idle);
    client.socket = null;
    battleBroadcast(battle,"player:disconnect");
    console.log("Le client vient de timeout");
}

function ping(client,battle) {
    client.socket.ping();
    console.log('ping envoyé');
    client.timeout = setTimeout(function(){clientTimeout(client,battle)},inactivity.timeout);
}

function clientSetup(battle, client){
	console.log('Performing client setup');
    client.idle = setTimeout(function(){ping(client,battle)},inactivity.timeout);

	client.socket.on('close', function(){
        clearTimeout(client.timeout);
        clearTimeout(client.idle);
        client.socket = null;
        battleBroadcast(battle,"player:disconnect");
        console.log("Le client fermer le jeu");
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

        clearTimeout(client.idle);
        client.idle = setTimeout(function(){ping(client,battle)},inactivity.timeout);

		switch (data.type){
			case 'attack':
				battle.engine.pushTask(battle.engine.attackPlayer, client.player, data.target, data.armament, data.room);
				break;
            case 'powerup':
                battle.engine.pushTask(battle.engine.changePower, 'up', client.player, data.targetId, data.targetType);
                break;
            case 'powerdown':
                battle.engine.pushTask(battle.engine.changePower, 'down', client.player, data.targetId, data.targetType);
                break;
		}
	});

    client.socket.on('pong',function(){
        console.log('pong reçu');
        clearTimeout(client.timeout);
        client.idle = setTimeout(function(){ping(client,battle)},15000);
    });
	
	//creates the player inside the battle
	API.getShip(client.token)
	.then(function(data){
		var player = battle.engine.addPlayer(data.name, data.hp, data.armaments, data.type, data.energy, data.modules);
		
		//assign the reference to the actual player object
		client.player = player;
		
		player.on('player:energy', function(energy){
			sendJSON(client, {
				type: 'energy',
				energy: energy
			});
		});
		
		player.on('armament:state', function(data){
			data.type = 'armament-state';
			sendJSON(client, data);
		});
		
		player.on('module:state', function(data){
			data.type = 'module-state';
			sendJSON(client, data);
		});
		
		console.log('Client setup complete');
		
		sendJSON(client, {
			type: 'identity',
			id: player.id
		});
		
		if (battle.clients.length == 2){
			battle.engine.start();
			battleBroadcast(battle, {type: 'battle-start'});
		}
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

            var client = null;
            battle.clients.every(function(cl){
                if (cl.token == token){
                    client = cl;
                    return false;
                }
                else{
                    return true;
                }
            });

            // En cas de reconnexion
            if (client != null) {
                client.socket = this;
                battle.engine.notifyPlayerInformation();
                sendJSON(client, {
                    type: 'identity',
                    id: player.id
                });
                battleBroadcast(battle, {type: 'battle-start'});
            }
			// En cas de nouvelle connexion :create client tracking object
            else {
                var client = {
                    socket: this,
                    token: token,
                    player: null,
                    timeout: null,
                    idle:null
                };
                battle.clients.push(client);
			    if (!battle.setup) battleSetup(battle);
			    clientSetup(battle, client);
            }
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