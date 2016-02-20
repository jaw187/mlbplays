'use strict';

// Load modules

const Code = require('code');
const Lab = require('lab');

const Mlb = require('../lib');

// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;

describe('Plays', () => {

    it('Can get plays', (done) => {

        const options = {
            path: 'year_2011/month_07/day_23/'
        };

        const mlb = new Mlb(options);

        mlb.get((err, plays) => {

            expect(err).to.not.exist();

            expect(plays).to.exist();
            expect(plays.length).to.exist();

            expect(plays[0].previous).to.not.exist();
            expect(plays[1].previous).to.exist();

            done();
        });
    });
});
