var WebSocketServer = require('ws').Server,
	wss = new WebSocketServer({port: 8080});

wss.on('connection', function(ws){
	console.log('new connection!');
	
	ws.on('message', function(message){
		console.log('received %s', message);
		ws.send(message);
	});
	ws.send('welcome');
});