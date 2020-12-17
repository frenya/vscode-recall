import * as assert from 'assert';
import { before, after } from 'mocha';
import * as sinon from 'sinon';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as path from 'path';

import Config from '../../config';
import Utils from '../../utils';

import expectedCards from '../fixtures/tasks2';

suite('Embedded card provider', () => {

  let filesData = null;
	before(async () => {
    // Get the tasks
    await Utils.embedded.initProvider ();

    filesData = await Utils.embedded.provider.getFilesData();
	});

  test('cards should be correctly identified', () => {
    const actual = Utils.embedded.provider.filesData[path.resolve(__dirname, '../../../demo/New Datacenter/Cards Demo.md')];

    assert.strictEqual(actual.length, expectedCards.length);

    actual.forEach((card, i) => {
      // console.log('Matching', t, 'to', i, expected[i]);
      sinon.assert.match(card, expectedCards[i]);
    });
  });

});

