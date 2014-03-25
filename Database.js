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

function setEndBattle(battleId) {
    var def = Q.defer();
    var end = new Date();
    var winner = 1;
    connection.query('SELECT player1, player2, start FROM Battle WHERE '+connection.escape(battleId), function(err, rows, fields){
        if (err) throw err;
        if (rows){
            console.log('Get battle '+battleId+' : OK');
        }
        else{
            console.log('No battle found for id '+token);
            def.reject();
        }
    });

    connection.query('INSERT INTO History (player1,player2,start,end,winner) VALUES ("'+rows[0].player1+'","'+rows[0].player2+'","'+rows[0].start+'","'+rows[0].end+'","'+rows[0].winner+'")', function(err, rows, fields){
        if (err) throw err;
        if (rows){
            console.log('Set history : OK');
        }
        else{
            console.log('No battle found for id '+token);
            def.reject();
        }
    });

    //@TODO Supprimer la bataille

}
exports.open = open;
exports.close = close;
exports.getBattleIdByToken = getBattleIdByToken;
exports.setEndBattle = setEndBattle;

})();