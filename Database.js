(function(){

var conf = require('./conf.json'),
	mysql = require('mysql'),
	Q = require('q');
var connection;

function open(){
	connection = mysql.createConnection({
		host     : conf.mysql.host,
		database : conf.mysql.database,
		user     : conf.mysql.user,
		password : conf.mysql.password
	});
}

function close(){
	connection.end();
}

function getBattleIdByToken(token){
	var def = Q.defer();
	
	connection.query('SELECT id FROM Battle WHERE player1 = '+connection.escape(token)+' OR player2 = '+connection.escape(token), function(err, rows, fields){
		if (err) throw err;
		
		if (rows){
			console.log('The battle ID of the player token '+token+' is '+rows[0].id);
			def.resolve(rows[0].id);
		}
		else{
			console.log('No battle found for token '+token);
			def.reject();
		}
	});

	return def.promise;
}

exports.open = open;
exports.close = close;
exports.getBattleIdByToken = getBattleIdByToken;

})();