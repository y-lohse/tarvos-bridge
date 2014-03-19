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
	battleBroadcast(battles[0], JSON.stringify({
		type: 'players',
		players: players
	}));
});

server.on('connection', function(ws){
	console.log('New connection');
	var battle = battles[0];
	
	battle.clients.push({
		socket: ws,
		player: {}
	});
    
    battle.engine.id = getBattleId(1); // @TODO : Token du joueur
	
	//apprently clients need a little delay before they receive messages
	setTimeout(function(){
		battle.engine.pushTask(battle.engine.addPlayer)
		.then(function(playerRef){
			battle.clients[battle.clients.length-1].player = playerRef;
		
			ws.send(JSON.stringify({
				type: 'identity',
				id: playerRef.id
			}));
		});
	}, 1);
	
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
	
	ws.on('message', function(data){
		data = JSON.parse(data);
		switch (data.type){
			case 'attack':
				battle.engine.pushTask(battle.engine.attackPlayer, [data.target]);
				break;
		}
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

function getBattleId(playerId) {
    var mysql      = require('mysql');
    var battleId;
    connection = getConnection(mysql);
    connection.connect();

    connection.query('SELECT id FROM battle WHERE player1 = '+playerId, function(err, rows, fields) {
      if (err) throw err;

      console.log('The solution is: ', rows[0].id);
    });
    battleId = rows[0].id;
    connection.end();
    
    return battleId;
}


function getConnection(mysql) {
    var connection = mysql.createConnection({
      host     : 'localhost',
      database : 'symfony',
      user     : 'root',
      password : ''
    });
    return connection;
}