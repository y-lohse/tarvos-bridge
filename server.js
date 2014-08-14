(function(){	

var WebSocketServer = require('ws').Server,
	server          = new WebSocketServer({port: 8080}),
    BattleIndex     = require('./BattleIndex.js'),
	API             = require('./API.js'),
    inactivity      = require('./conf.json').inactivity;

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

    battle.engine.on('battle:wait', function(){
        battleBroadcast(battle, {type: 'battle-wait'});
    });
    
    battle.engine.on('battle:init', function(){
        battleBroadcast(battle, {type: 'battle-init'});
    });
    
    battle.engine.on('battle:start', function(){
        battleBroadcast(battle, {type: 'battle-start'});
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
    console.log('Client timeout');
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
                if (!client.player || !isInteger(data.playerId) || !isInteger(data.armamentId) || !isInteger(data.roomId) ) break;
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
                battle.engine.pushTask(battle.engine.moveCrew, client.player, data.crewId, data.moduleId);
                break;
            case 'opendoor':
                battle.engine.pushTask(battle.engine.manageDoor, client.player, doorId, true);
                break;
            case 'closedoor':
                battle.engine.pushTask(battle.engine.manageDoor, doorId, false);
                break;

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
		var player = battle.engine.addPlayer(data.name, data.hp, data.radar, data.armaments, data.fighters, data.type, data.energy, data.modules, data.crews);
		
		//assign the reference to the actual player object
		client.player = player;
		
		player.onAny(function(data){
			data.type = this.event;
			sendJSON(client, data);
		});
		
		console.log('Client setup complete');
		
		sendJSON(client, {
			type: 'identity',
			id: player.id
		});
		
		if (battle.clients.length == 2){
			battle.clients[0].player.target = battle.clients[1].player;
			battle.clients[1].player.target = battle.clients[0].player;
			
			battle.engine.wait();
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
                    console.log('Client returned');
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
                sendJSON(client, {
                    type: 'identity',
                    id: client.player.id
                });
                battle.engine.notifyPlayerInformation();
                battleBroadcast(battle, {type: 'battle-init'});
                battleBroadcast(battle, {type: 'battle-start'});//@FIXME: pas sur que la bataille ai démaré
                client.idle = setTimeout(ping, inactivity.timeout, client, battle);
            }
			// En cas de nouvelle connexion :create client tracking object
            else {
                console.log('New client');
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
		(function(code){
			console.log('Token %s has no battle associated to it', token);
			console.log('Error code '+code+'. Dropping client.');
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