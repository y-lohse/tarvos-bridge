var WebSocketServer = require('ws').Server,
	server = new WebSocketServer({port: 8080});
var TarvosBattle = require('tarvos-battle').TarvosBattle;

console.log('Server started');

var battles = [];
var engine = new TarvosBattle();
battles.push({
	engine: engine,
	clients: []
});

engine.on('players:update', function(players){
	battleBroadcast(battles[0], JSON.stringify(players));
});

server.on('connection', function(ws){
	console.log('New connection');
	var battle = battles[0];
	
	battle.clients.push({
		socket: ws,
		player: {}
	});
	var playerRef = battle.engine.addPlayer();
	battle.clients[battle.clients.length-1].player = playerRef;
	
	clientSetup(battle, ws);
});

function clientSetup(battle, ws){	
	ws.on('close', function(){
		battle.clients.every(function(client, index){
			if (client.socket === ws){
				battle.clients.splice(index, 1);
				battle.engine.removePlayer(client.player);
				return false;
			}
			else{
				return true;
			}
		});
	});
}

function battleBroadcast(battle, message){
	console.log('Broadcasting to '+battle.clients.length+' clients on battle '+battle.engine.id);
	console.log(message);
	battle.clients.forEach(function(client){
		client.socket.send(message, function(err){
			if (err) console.log('error');
		});
	});
}