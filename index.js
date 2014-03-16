var WebSocketServer = require('ws').Server,
	wss = new WebSocketServer({port: 8080});
	
var TarvosBattle = require('tarvos-battle').TarvosBattle;

var battles = [];
var engine = new TarvosBattle();
battles.push({
	engine: engine,
	clients: []
});

wss.on('connection', function(ws){
	var battle = battles[0];
	
	var playerRef = battle.engine.addPlayer();
	battle.clients.push({
		client: ws,
		player: playerRef
	});
	clientSetup(battle, ws);
});

function clientSetup(battle, ws){	
	ws.on('close', function(){
		//@TODO: remove from game
		battle.clients.every(function(client, index){
			if (client.client === ws){
				battle.clients.splice(index, 1);
				return false;
			}
			else{
				return true;
			}
		});
	});
	
	//send initial data
	var players = [];
	battle.clients.forEach(function(client){
		var p = {
			id: client.player.id,
			hp: client.player.hp,
		}
		players.push(p);
	});
	
	battle.clients.forEach(function(client){
		client.client.send(JSON.stringify(players), function(err){
			if (err) console.log('error');
		});
	});
}