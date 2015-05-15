// Load modules

var Wreck = require('wreck');
var Hoek = require('hoek');
var Insync = require('insync');

// Declare internals

var internals = {};


internals.mlb = require('./mlb.json');
internals.baseUrl = internals.mlb.protocol + '://' + internals.mlb.host + internals.mlb.basepath + '/';


internals.get = function (options, callback) {

    Hoek.assert(callback, 'Callback is required');

    if (!options.path) {
        return callback(new Error('Path is required'));
    }

    var url = internals.baseUrl + options.path + internals.mlb.files[options.which];
    Wreck.get(url, { json: true }, function (err, response, payload) {

        return callback(err, payload);
    });
};

internals.getScoreboard = function (options, callback) {

    options = options || {};
    options.which = 'scoreboard';

    return internals.get(options, callback);
};


internals.getPlays = function (options, callback) {

    options = options || {};

    var games = Hoek.reach(options, 'scoreboard.data.games.game');

    if (!(options.path && games)) {
        return callback(new Error('Path and Scoreboard with games are required'));
    }

    var getPlays = function (game, next) {

        var playsOptions = {
            path: options.path + 'gid_' + game.gameday + '/',
            which: 'plays'
        };

        return internals.get(playsOptions, next);
    };

    Insync.map(games, getPlays, function (err, plays) {

        return callback(err, plays);
    });
};


internals.getGameevents = function (options, callback) {

    options = options || {};

    var games = Hoek.reach(options, 'scoreboard.data.games.game');

    if (!(options.path && games)) {
        return callback(new Error('Path and Scoreboard with games are required'));
    }

    var getGameevents = function (game, next) {

        var eventsOptions = {
            path: options.path + 'gid_' + game.gameday + '/',
            which: 'game_events'
        };

        return internals.get(eventsOptions, function (err, events) {

            if (events === 'GameDay - 404 Not Found') {
                return next(null, {});
            }

            if (events) {
                events.path = options.path;
                events.gameday = game.gameday;
            }

            return next(err, events);
        });
    };

    Insync.map(games, getGameevents, function (err, events) {

        return callback(err, events);
    });
};


module.exports = internals.Plays = function (options) {

    this.options = options;
    this.plays = [];
};


internals.Plays.prototype.get = function (callback) {

    var self = this;

    var getScoreboard = function (next) {

        internals.getScoreboard(self.options, function (err, scoreboard) {

            self.options.scoreboard = scoreboard;
            return next(err);
        });
    };

    var getPlays = function (next) {

        internals.getGameevents(self.options, function (err, gameevents) {

            gameevents = gameevents || [];

            for (var i = 0, il = gameevents.length; i < il; ++i) {

                var events = gameevents[i];
                var game = Hoek.reach(gameevents[i], 'data.game') || {};
                var innings = game.inning || [];

                for (var j = 0, jl = innings.length; j < jl; ++j) {
                    var inning = innings[j];
                    var top = Hoek.reach(inning, 'top.atbat') || [];
                    var bottom = Hoek.reach(inning, 'bottom.atbat') || [];

                    for (var k = 0, kl = top.length; k < kl; ++k) {
                        var topAtbat = top[k];
                        topAtbat.inningNumber = inning.num;
                        topAtbat.batterNumber = k + 1;
                        topAtbat.path = events.path;
                        topAtbat.gameday = events.gameday;
                        self.plays.push(topAtbat);
                    }

                    for (var l = 0, ll = bottom.length; l < ll; ++l) {
                        var bottomAtbat = bottom[l];
                        bottomAtbat.inningNumber = inning.num;
                        bottomAtbat.batterNumber = l + 1;
                        bottomAtbat.path = events.path;
                        bottomAtbat.gameday = events.gameday;
                        self.plays.push(bottomAtbat);
                    }
                }
            }

            return next();
        });
    };

    Insync.series([
        getScoreboard,
        getPlays
    ], function (err) {

        return callback(err, self.plays);
    });
};
