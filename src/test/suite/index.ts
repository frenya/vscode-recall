'use strict';

import * as path from 'path';
import * as Mocha from 'mocha';
const NYC = require('nyc');
import * as glob from 'glob';

// Simulates the recommended config option
// extends: "@istanbuljs/nyc-config-typescript",
import * as baseConfig from "@istanbuljs/nyc-config-typescript";

// Recommended modules, loading them here to speed up NYC init
// and minimize risk of race condition
import 'ts-node/register';
import 'source-map-support/register';


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
    ...baseConfig,
    cwd: path.join(__dirname, '..', '..', '..'),
    reporter: ['text-summary', 'html'],
    all: true,
    silent: false,
    instrument: true,
    hookRequire: true,
    hookRunInContext: true,
    hookRunInThisContext: true,
    include: [ "out/**/*.js" ],
    exclude: [ "out/test/**" ],
  });
  await coverageRunner.wrap();

  await coverageRunner.createTempDirectory();
	// Create the mocha test
	const mocha = new Mocha({
		ui: 'tdd',
    timeout: 10 * 1000,
	});
  mocha.useColors(true);
  
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
