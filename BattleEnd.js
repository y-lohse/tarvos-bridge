(function(){

var TarvosEngine = require('tarvos-battle'),
    Database = require('./Database.js'),
    Q = require('q');

function setEndBattle(battle) {
    var def = Q.defer();

    Database.open();
    Database.setEndBattle(battle.id).then(function(){
        Database.close();
    },function(){
            Database.close();
            def.reject();
    });
    return def.promise;
}

exports.setEndBattle = setEndBattle;


})();