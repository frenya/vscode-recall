import * as assert from 'assert';
import { before, after } from 'mocha';
import * as sinon from 'sinon';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as path from 'path';

import Utils from '../../utils';

import { decorationBadgeState } from '../../decorators';

// Card stubs (only the state and reverse* fields are needed)
let singleCard = { reverse: false, state: 'NEW' };
let originalCard = { reverse: false, state: 'NEW', reverseFor: undefined };
let reverseCard = { reverse: true, state: 'NEW', reverseFor: originalCard };
originalCard.reverseFor = reverseCard;

// Replacer to avoid circular reference in JSON
const ignoreReverseFor = (key, value) => key === 'reverseFor' ? null : value;

suite('Decoration badges', () => {

  test('initial state', () => {
    assert.strictEqual(decorationBadgeState(singleCard), 'NEW');
    assert.strictEqual(decorationBadgeState(originalCard), 'NEW');
    assert.strictEqual(decorationBadgeState(reverseCard), undefined);
  });

  test('archival of original card', () => {
    singleCard.state = 'ARCHIVED';
    originalCard.state = 'ARCHIVED';
    assert.strictEqual(decorationBadgeState(singleCard), 'ARCHIVED');
    assert.strictEqual(decorationBadgeState(originalCard), undefined);
    assert.strictEqual(decorationBadgeState(reverseCard), 'ARCHIVED.NEW');
  });

  test('archival of reverse card', () => {
    reverseCard.state = 'ARCHIVED';
    assert.strictEqual(decorationBadgeState(singleCard), 'ARCHIVED');
    assert.strictEqual(decorationBadgeState(originalCard), undefined);
    assert.strictEqual(decorationBadgeState(reverseCard), 'ARCHIVED');
  });

});

