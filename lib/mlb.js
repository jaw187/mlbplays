'use strict';

// Load modules

const Hoek = require('hoek');
const Insync = require('insync');
const Wreck = require('wreck');


// Declare internals

const internals = {};


internals.mlb = require('./mlb.json');
internals.baseUrl = internals.mlb.protocol + '://' + internals.mlb.host + internals.mlb.basepath + '/';


internals.get = function (options, callback) {

    Hoek.assert(callback, 'Callback is required');

    if (!options.path) {
        return callback(new Error('Path is required'));
    }

    const url = internals.baseUrl + options.path + internals.mlb.files[options.which];
    Wreck.get(url, { timeout: 10000, json: true }, (err, response, payload) => {

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

    let games = Hoek.reach(options, 'scoreboard.data.games.game');

    if (!(options.path && games)) {
        return callback(new Error('Path and Scoreboard with games are required'));
    }

    if (!(games.constructor === Array)) {
        games = [games];
    }

    const getPlays = function (game, next) {

        const playsOptions = {
            path: options.path + 'gid_' + game.gameday + '/',
            which: 'plays'
        };

        return internals.get(playsOptions, next);
    };

    Insync.map(games, getPlays, (err, plays) => {

        return callback(err, plays);
    });
};


internals.getGameevents = function (options, callback) {

    options = options || {};

    let games = Hoek.reach(options, 'scoreboard.data.games.game');

    if (!(options.path && games)) {
        return callback(new Error('Path and Scoreboard with games are required'));
    }

    if (!(games.constructor === Array)) {
        games = [games];
    }

    const getGameevents = function (game, next) {

        const eventsOptions = {
            path: options.path + 'gid_' + game.gameday + '/',
            which: 'game_events'
        };

        return internals.get(eventsOptions, (err, events) => {

            if (events === 'GameDay - 404 Not Found') {
                return next(null, {});
            }

            if (events) {
                events.path = options.path;
                events.gameday = game.gameday;
                events.venue = game.venue_id;
                events.home_team_id = game.home_team_id;
                events.away_team_id = game.away_team_id;
            }

            return next(err, events);
        });
    };

    Insync.map(games, getGameevents, (err, events) => {

        return callback(err, events);
    });
};


module.exports = internals.Plays = function (options) {

    this.options = options;
    this.plays = [];
};


internals.Plays.prototype.get = function (callback) {

    const getScoreboard = (next) => {

        internals.getScoreboard(this.options, (err, scoreboard) => {

            this.options.scoreboard = scoreboard;
            return next(err);
        });
    };

    const getPlays = (next) => {

        internals.getGameevents(this.options, (err, gameevents) => {

            gameevents = gameevents || [];

            for (let i = 0; i < gameevents.length; ++i) {

                const events = gameevents[i];
                const game = Hoek.reach(gameevents[i], 'data.game') || {};
                const innings = game.inning || [];

                for (let j = 0; j < innings.length; ++j) {
                    const inning = innings[j];
                    internals.getAtBats(inning, events, this.plays);
                    internals.getActions(inning, events, this.plays);
                }
            }

            return next(err);
        });
    };

    Insync.series([
        getScoreboard,
        getPlays
    ], (err) => {

        return callback(err, this.plays);
    });
};


internals.getAtBats = function (inning, events, plays) {

    const top = Hoek.reach(inning, 'top.atbat') || [];
    const bottom = Hoek.reach(inning, 'bottom.atbat') || [];

    const atbat = {
        inningNumber: inning.num,
        path: events.path,
        gameday: events.gameday,
        venue: events.venue,
        home_team_id: events.home_team_id,
        away_team_id: events.away_team_id
    };

    for (let i = 0; i < top.length; ++i) {
        const topAtbat = top[i];

        Hoek.merge(topAtbat, atbat);
        topAtbat.batterNumber = i + 1;
        topAtbat.batterTeam = atbat.away_team_id;
        topAtbat.pitcherTeam = atbat.home_team_id;

        if (i > 0) {
            topAtbat.previous = plays[plays.length - 1];
        }

        plays.push(topAtbat);
    }

    for (let i = 0; i < bottom.length; ++i) {
        const bottomAtbat = bottom[i];

        Hoek.merge(bottomAtbat, atbat);
        bottomAtbat.batterNumber = i + 1;
        bottomAtbat.batterTeam = atbat.home_team_id;
        bottomAtbat.pitcherTeam = atbat.away_team_id;

        if (i > 0) {
            bottomAtbat.previous = plays[plays.length - 1];
        }

        plays.push(bottomAtbat);
    }
};


internals.getActions = function (inning, events, plays) {

    let top = Hoek.reach(inning, 'top.action') || [];
    let bottom = Hoek.reach(inning, 'bottom.action') || [];

    if (top.length === undefined) {
        top = [top];
    }

    if (bottom.length === undefined) {
        bottom = [bottom];
    }

    top.map((action) => {

        action.pitcherTeam = events.home_team_id;
    });

    bottom.map((action) => {

        action.pitcherTeam = events.away_team_id;
    });

    const actions = top.concat(bottom);

    const baseAction = {
        inningNumber: inning.num,
        path: events.path,
        gameday: events.gameday,
        venue: events.venue,
        home_team_id: events.home_team_id,
        away_team_id: events.away_team_id
    };

    for (let i = 0; i < actions.length; ++i) {
        const action = actions[i];
        Hoek.merge(action, baseAction);
        plays.push(action);
    }
};
