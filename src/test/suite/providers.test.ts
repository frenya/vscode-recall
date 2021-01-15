import * as assert from 'assert';
import { before, after } from 'mocha';
import * as sinon from 'sinon';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as path from 'path';

import Utils from '../../utils';

import expectedCardsHeader from '../fixtures/cards_demo';
import expectedCardsAsterisk from '../fixtures/asterisk_demo';
import expectedCardsBullet from '../fixtures/bullet_demo';
import expectedCardsReverse from '../fixtures/reverse_demo';

// Replacer to avoid circular reference in JSON
const ignoreReverseFor = (key, value) => {
  if (key === 'reverseFor' && value) {
    const { reverseFor, ...clean } = value;
    return clean; 
  }
  else return value;
};

suite('Embedded card provider', () => {

	before(async () => {
    // Get the tasks
    await Utils.embedded.initProvider ();
	});

  test('header cards should be correctly identified', async () => {
    const actual = await Utils.embedded.provider.getFileData(path.resolve(__dirname, '../../../demo/Cards Demo.md'));

    // console.log(JSON.stringify(actual.data, ignoreReverseFor, 2));
    assert.strictEqual(actual.data.length, expectedCardsHeader.length);

    actual.data.forEach((card, i) => {
      // console.log('Matching', t, 'to', i, expected[i]);
      sinon.assert.match(card, expectedCardsHeader[i]);
    });
  });

  test('asterisk cards should be correctly identified', async () => {
    const actual = await Utils.embedded.provider.getFileData(path.resolve(__dirname, '../../../demo/Asterisk Demo.md'));

    // console.log(JSON.stringify(actual.data, ignoreReverseFor, 2));
    assert.strictEqual(actual.data.length, expectedCardsAsterisk.length);

    actual.data.forEach((card, i) => {
      // console.log('Matching', t, 'to', i, expected[i]);
      sinon.assert.match(card, expectedCardsAsterisk[i]);
    });
  });

  test('bullet cards should be correctly identified', async () => {
    const actual = await Utils.embedded.provider.getFileData(path.resolve(__dirname, '../../../demo/Bullets Demo.md'));

    // console.log(JSON.stringify(actual.data, ignoreReverseFor, 2));
    assert.strictEqual(actual.data.length, expectedCardsBullet.length);

    actual.data.forEach((card, i) => {
      // console.log('Matching', t, 'to', i, expected[i]);
      sinon.assert.match(card, expectedCardsBullet[i]);
    });
  });

  test('reverse cards should be correctly identified', async () => {
    const actual = await Utils.embedded.provider.getFileData(path.resolve(__dirname, '../../../demo/Reverse Demo.md'));

    // console.log(JSON.stringify(actual.data, ignoreReverseFor, 2));
    assert.strictEqual(actual.data.length, expectedCardsReverse.length);

    actual.data.forEach((card, i) => {
      // console.log('Matching', t, 'to', i, expected[i]);
      sinon.assert.match(card, expectedCardsReverse[i]);
    });
  });

});

