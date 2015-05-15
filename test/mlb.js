// Load modules

var Code = require('code');
var Lab = require('lab');

var Mlb = require('../');

// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;

describe('Plays', function () {

    it('Can get plays', function (done) {

        var options = {
            path: 'year_2011/month_07/day_23/'
        };

        var mlb = new Mlb(options);

        mlb.get(function (err, plays) {

            expect(plays).to.exist();
            done();
        });
    });
});
