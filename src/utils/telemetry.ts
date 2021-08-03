import { Buffer } from 'buffer';
import { extensions, WorkspaceConfiguration } from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { userInfo } from 'os';
import { sep } from 'path';

export class Reporter {
  private reporter: TelemetryReporter;
  private timeOpened: number;
  private lastStackTrace: string;
  numRuns: number;
  numInterruptedRuns: number;
  execTime: number;
  totalPyTime: number;
  totalTime: number;
  pythonVersion: string;

  constructor(private enabled: boolean) {
    const extensionId = 'frenya.vscode-recall';
    const extension = extensions.getExtension(extensionId)!;
    const extensionVersion = extension.packageJSON.version;

    // following key just allows you to send events to azure insights API
    // so it does not need to be protected
    // but obfuscating anyways - bots scan github for keys, but if you want my key you better work for it, damnit!
    const innocentKitten = Buffer.from(
      'NmE3YmNjOTYtZjVmYi00NDIwLTgyZjktYzRhNDUxNzhiMGE2',
      'base64',
    ).toString();

    this.reporter = new TelemetryReporter(extensionId, extensionVersion, innocentKitten);
    this.resetMeasurements();
  }

  sendError(error: Error, code: number = 0, category = 'typescript') {
    console.error(`${category} error: ${error.name} code ${code}\n${error.stack}`);
    if (this.enabled) {
      error.stack = this.anonymizePaths(error.stack);

      // no point in sending same error twice (and we want to stay under free API limit)
      if (error.stack === this.lastStackTrace) return;

      this.reporter.sendTelemetryException(error, {
        code: code.toString(),
        category,
      });

      this.lastStackTrace = error.stack;
    }
  }

  commandWrapper(cmdName: string, cmdHandler: Function) {
    const reporter = this.reporter;
    return function (...args) {
      reporter.sendTelemetryEvent(cmdName);
      return cmdHandler(...args);
    };
  }

  sendEvent(event: string) {
    this.reporter.sendTelemetryEvent(event);
  }

  private resetMeasurements() {
    this.timeOpened = Date.now();

    this.numRuns = 0;
    this.numInterruptedRuns = 0;
    this.execTime = 0;
    this.totalPyTime = 0;
    this.totalTime = 0;
  }

  /**
   * replace username with anon
   */
  anonymizePaths(input: string) {
    // tslint:disable-next-line:triple-equals
    if (input == null) return input;
    return input.replace(new RegExp('\\' + sep + userInfo().username, 'g'), sep + 'anon');
  }

  dispose() {
    this.reporter.dispose();
  }
}

export default Reporter as typeof Reporter;
