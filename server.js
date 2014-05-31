(function(){	

var WebSocketServer = require('ws').Server,
	server = new WebSocketServer({port: 8080});
var BattleIndex = require('./BattleIndex.js'),
	API = require('./API.js'),
    inactivity = require('./conf.json').inactivity;

console.log('Socket started');

//sends data to a single client
function sendJSON(client, data){
    if(client.socket != null) {
        try{
        	 client.socket.send(JSON.stringify(data), function(err){
				if (err) console.log('error while sending data to client');
			});
		}
        catch(e){
        	console.log(e);
        	console.log(e.stack);
        	console.log(data);
        }
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
        battle.clients.forEach(function(client){
            clearTimeout(client.timeout);
            clearTimeout(client.idle);
        });
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
    if(client.socket != null) {
        try {
            client.socket.ping();
        } catch (err) {
            console.log("Warning : can't ping client - "+err);
        }
        client.timeout = setTimeout(clientTimeout, inactivity.timeout, client, battle);
    }
}

function isInteger(data) {
    if (data && data !== null && data === parseInt(data)) return true;
    else {
        console.log("Warning : data : "+data+" is not an integer");

        return false;
    }
}

function socketSetup(battle,client) {
    client.socket.on('close', function(){
        clearTimeout(client.timeout);
        clearTimeout(client.idle);
        client.socket = null;
        battleBroadcast(battle,"player:disconnect");
        console.log("Client closed the game");
    });

    client.socket.on('message', function(data){
        if(!data || data === null) return;
        data = JSON.parse(data);

        clearTimeout(client.idle);
        client.idle = setTimeout(ping, inactivity.timeout, client, battle);

        switch (data.type){
            case 'attack':
                if (client.player === null || !isInteger(data.playerId) || !isInteger(data.armamentId) || !isInteger(data.roomId) ) break;
                var player;
                battle.clients.every(function(client){
                	if (client.player.id === data.playerId){
                		player = client.player;
                		return false;
                	}
                	else{
                		return true;
                	}
                });
                
                var armament = client.player.getArmament(data.armamentId),
                	module = player.getModuleById(data.roomId);
                battle.engine.pushTask(battle.engine.attackPlayer, player, armament, module);
                break;
            case 'powerup':
                if (client.player === null || !isInteger(data.targetId) || data.targetType === null ) break;
                battle.engine.pushTask(battle.engine.changePower, 'up', client.player, data.targetId, data.targetType);
                break;
            case 'powerdown':
                if (client.player === null || !isInteger(data.targetId) || data.targetType === null ) break;
                battle.engine.pushTask(battle.engine.changePower, 'down', client.player, data.targetId, data.targetType);
                break;
            case 'movecrew':
                battle.engine.pushTask()
        }
    });

    client.socket.on('pong',function(){
        clearTimeout(client.timeout);
        client.idle = setTimeout(ping, inactivity.timeout, client, battle);
    });
}

function clientSetup(battle, client){
	console.log('Performing client setup');
    client.idle = setTimeout(ping, inactivity.timeout, client, battle);

    socketSetup(battle, client);
	
	//creates the player inside the battle
	API.getShip(client.token)
	.then(function(data){
		var player = battle.engine.addPlayer(data.name, data.hp, data.armaments, data.fighters, data.type, data.energy, data.modules, data.crews);
		
		//assign the reference to the actual player object
		client.player = player;
		
		player.on('player:energy', function(energy){
			sendJSON(client, {
				type: 'energy',
				energy:energy
			});
		});

		player.on('armament:state', function(id, state){
			sendJSON(client, {
				id: id,
				type: 'armament-state',
				state: state
			});
		});
		
		player.on('armament:energy', function(id, energy){
			sendJSON(client, {
				id: id,
				type:'armament-energy',
				energy: energy
			});
		});

        player.on('fighter:state', function(id, state){
            battleBroadcast(battle, {
				type: 'fighter-state',
				id: id,
				state: state,
				player: player.id
			});
        });

        player.on('fighter:energy', function(id, energy){
            battleBroadcast(battle, {
				type: 'fighter-energy',
				id: id,
				energy: energy,
				player: player.id
			});
        });

        player.on('module:hp', function(id, hp, energy){
            sendJSON(client, {
                id: id,
                type:'module-hp',
                energy: energy,
                hp : hp
            });
        });

		player.on('module:breached', function(id, breached){
			sendJSON(client, {
				id: id,
				type:'module-breached',
				breached: breached
			});
		});
		
		player.on('module:energy', function(id, energy){
			sendJSON(client, {
				id: id,
				type:'module-energy',
				energy: energy
			});
		});
		
		player.on('module:oxygen', function(id, oxygen){
			sendJSON(client, {
				id: id,
				type: 'module-oxygen',
				oxygen: oxygen
			});
		});
		
		player.on('module:state', function(id, state){
			battleBroadcast(battle, {
				type: 'module-state',
				id: id,
				state: state,
				player: player.id
			});
		});
		
		player.on('shield:state', function(data){
			data.type = 'shield-state';
			data.player = player.id;
			battleBroadcast(battle, data);
		});
		
		console.log('Client setup complete');
		
		sendJSON(client, {
			type: 'identity',
			id: player.id
		});
		
		if (battle.clients.length == 2){
			battle.clients[0].player.target = battle.clients[1].player;
			battle.clients[1].player.target = battle.clients[0].player;
			
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
                    console.log("Reconnection du client");
                    return false;
                }
                else{
                    return true;
                }
            });

            // En cas de reconnexion
            if (client != null) {
                client.socket = this;
                socketSetup(battle,client);
                battle.engine.notifyPlayerInformation();
                sendJSON(client, {
                    type: 'identity',
                    id: client.player.id
                });
                battleBroadcast(battle, {type: 'battle-start'});
                client.idle = setTimeout(ping, inactivity.timeout, client, battle);
            }
			// En cas de nouvelle connexion :create client tracking object
            else {
                console.log("Nouvelle connection");
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