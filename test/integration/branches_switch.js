"use strict";

var co = require('co');
var _         = require('underscore');
var ucoin     = require('./../../index');
var bma       = require('./../../app/lib/streams/bma');
var user      = require('./tools/user');
var rp        = require('request-promise');
var httpTest  = require('./tools/http');
var commit    = require('./tools/commit');
var sync      = require('./tools/sync');
var constants = require('./../../app/lib/constants');

var expectJSON     = httpTest.expectJSON;

var MEMORY_MODE = true;
var commonConf = {
  ipv4: '127.0.0.1',
  currency: 'bb',
  httpLogs: true,
  forksize: 30,
  avgGenTime: 1,
  parcatipate: false, // TODO: to remove when startGeneration will be an explicit call
  sigQty: 1
};

var s1 = ucoin({
  memory: MEMORY_MODE,
  name: 'bb11'
}, _.extend({
  port: '7788',
  pair: {
    pub: 'HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd',
    sec: '51w4fEShBk1jCMauWu4mLpmDVfHksKmWcygpxriqCEZizbtERA6de4STKRkQBpxmMUwsKXRjSzuQ8ECwmqN1u2DP'
  },
  participate: false, rootoffset: 10,
  sigQty: 1, dt: 0, ud0: 120
}, commonConf));

var s2 = ucoin({
  memory: MEMORY_MODE,
  name: 'bb12'
}, _.extend({
  port: '7789',
  pair: {
    pub: 'DKpQPUL4ckzXYdnDRvCRKAm1gNvSdmAXnTrJZ7LvM5Qo',
    sec: '64EYRvdPpTfLGGmaX5nijLXRqWXaVz8r1Z1GtaahXwVSJGQRn7tqkxLb288zwSYzELMEG5ZhXSBYSxsTsz1m9y8F'
  }
}, commonConf));

var cat = user('cat', { pub: 'HgTTJLAQ5sqfknMq7yLPZbehtuLSsKj9CxWN7k8QvYJd', sec: '51w4fEShBk1jCMauWu4mLpmDVfHksKmWcygpxriqCEZizbtERA6de4STKRkQBpxmMUwsKXRjSzuQ8ECwmqN1u2DP'}, { server: s1 });
var toc = user('toc', { pub: 'DKpQPUL4ckzXYdnDRvCRKAm1gNvSdmAXnTrJZ7LvM5Qo', sec: '64EYRvdPpTfLGGmaX5nijLXRqWXaVz8r1Z1GtaahXwVSJGQRn7tqkxLb288zwSYzELMEG5ZhXSBYSxsTsz1m9y8F'}, { server: s1 });

describe("Switch", function() {

  before(() => co(function *() {
    yield s1.initWithDAL().then(bma).then((bmapi) => bmapi.openConnections());
    yield s2.initWithDAL().then(bma).then((bmapi) => bmapi.openConnections());
    yield cat.selfCertPromise();
    yield toc.selfCertPromise();
    yield toc.certPromise(cat);
    yield cat.certPromise(toc);
    yield cat.joinPromise();
    yield toc.joinPromise();
    yield commit(s1)();
    yield commit(s1)();
    yield commit(s1)();
    yield sync(0, 2, s1, s2);

    let s2p = yield s2.PeeringService.peer();

    yield commit(s1)();
    yield commit(s1)();
    yield commit(s2)();
    yield commit(s2)();
    yield commit(s2)();
    yield commit(s2)();
    yield commit(s2)();
    yield commit(s2)();
    yield commit(s2)();
    // So we now have:
    // S1 01234
    // S2   `3456789
    let oldVal = constants.BRANCHES.SWITCH_ON_BRANCH_AHEAD_BY_X_MINUTES = 0;

    yield s1.singleWritePromise(s2p);

    // Forking S1 from S2
    yield s1.pullBlocks(s2p.pubkey);

    constants.BRANCHES.SWITCH_ON_BRANCH_AHEAD_BY_X_MINUTES = oldVal;
    // S1 should have switched to the other branch
  }));

  describe("Server 1 /blockchain", function() {

    it('/block/8 should exist on S1', function() {
      return expectJSON(rp('http://127.0.0.1:7788/blockchain/block/8', { json: true }), {
        number: 8
      });
    });

    it('/block/8 should exist on S2', function() {
      return expectJSON(rp('http://127.0.0.1:7789/blockchain/block/8', { json: true }), {
        number: 8
      });
    });

    it('/block/7 should have valid monetary mass', function() {
      return co(function *() {
        let block = yield s1.dal.getBlock(7);
        block.should.have.property('UDTime').not.equal(null);
      });
    });

    it('/block/8 should have valid monetary mass', function() {
      return co(function *() {
        let block = yield s1.dal.getBlock(8);
        block.should.have.property('UDTime').not.equal(null);
      });
    });
  });
});
