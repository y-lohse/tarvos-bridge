var WebSocketServer = require('ws').Server,
	wss = new WebSocketServer({port: 8080});

wss.on('connection', function(ws){
	console.log('new connection');
	
	ws.on('message', function(message){
		console.log('received %s', message);
		ws.send(message);
	});
	
	ws.send('welcome');
});

wss.broadcast = function(message){
	console.log('broadcasting '+message);
	for (var i in this.clients){
		this.clients[i].send(message.toString());
	}
}

var i = 0;
setInterval(function(){
	wss.broadcast(i++);
}, 2000);