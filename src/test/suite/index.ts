'use strict';

import * as path from 'path';
import * as Mocha from 'mocha';
const NYC = require('nyc');
import * as glob from 'glob';

import * as mocks from './mocks';

// Linux: prevent a weird NPE when mocha on Linux requires the window size from the TTY
// Since we are not running in a tty environment, we just implementt he method statically
const tty = require('tty');
if (!tty.getWindowSize) {
    tty.getWindowSize = (): number[] => {
        return [80, 75];
    };
}

export async function run(): Promise<void> {
	const testsRoot = path.resolve(__dirname, '..');

  // Setup coverage pre-test, including post-test hook to report
  const coverageRunner = new NYC({
    cwd: path.join(__dirname, '..', '..', '..'),
    reporter: ['text', 'html'],
    all: true,
    instrument: true,
    hookRequire: true,
    hookRunInContext: true,
    hookRunInThisContext: true,
  });
  await coverageRunner.reset();   // Reinitializes .nyc_output folder
  await coverageRunner.wrap();

	// Create the mocha test
	const mocha = new Mocha({
		ui: 'tdd',
    timeout: 10 * 1000,
	});
  mocha.useColors(true);
  
  // Register all mocks
  mocks.setUp();

  const files = glob.sync('**/*.test.js', { cwd: testsRoot });

  // Add files to the test suite
  files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

  const failures: number = await new Promise(resolve => mocha.run(resolve));
  await coverageRunner.writeCoverageFile();
  await coverageRunner.report();

  if (failures > 0) {
    throw new Error(`${failures} tests failed.`);
  }
}
