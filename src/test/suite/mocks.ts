import * as mockery from 'mockery';
import * as sinon from 'sinon';

export function setUp () {
  mockery.enable({
    warnOnUnregistered: false
  });
}

export function tearDown () {
  mockery.deregisterAll();
  mockery.disable();
}
