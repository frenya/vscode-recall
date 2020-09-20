'use strict';

import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';

import * as mocks from './mocks';
import { CoverageRunner } from './coverage';

const coverOptions = require('../../../coverconfig.json');

// Linux: prevent a weird NPE when mocha on Linux requires the window size from the TTY
// Since we are not running in a tty environment, we just implementt he method statically
const tty = require('tty');
if (!tty.getWindowSize) {
    tty.getWindowSize = (): number[] => {
        return [80, 75];
    };
}

function setupCoverage(testsRoot) {
  const NYC = require('nyc');
  const coverageRunner = new NYC({
    cwd: testsRoot,
    reporter: ['text', 'html'],
    all: true,
    instrument: true,
    hookRequire: true,
    hookRunInContext: true,
    hookRunInThisContext: true,
  });

  coverageRunner.createTempDirectory();
  coverageRunner.reset();
  coverageRunner.wrap();

  return coverageRunner;
}

export function run(): Promise<void> {
	const testsRoot = path.resolve(__dirname, '..');

  // Setup coverage pre-test, including post-test hook to report
  const coverageRunner = setupCoverage(testsRoot);

	// Create the mocha test
	const mocha = new Mocha({
		ui: 'tdd',
    timeout: 10 * 1000,
	});
	mocha.useColors(true);

  return new Promise((c, e) => {
    glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
      if (err) {
        return e(err);
      }

      // Register all mocks
      mocks.setUp();

      // Add files to the test suite
      files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

      try {
        // Run the mocha test
        mocha.run(failures => {
          mocks.tearDown();
          // Report coverage results
          if (coverageRunner) {
            console.log('Coverage report:');
            coverageRunner.writeCoverageFile();
            coverageRunner.report();
          }
          else console.warn('No coverage runner');
  
          if (failures > 0) {
            e(new Error(`${failures} tests failed.`));
          } else {
            c();
          }
        });
      } catch (err) {
        mocks.tearDown();
        e(err);
      }
    });
  });
}
