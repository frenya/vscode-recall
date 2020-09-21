
/* IMPORT */

import * as _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import Utils from '../utils';
import { open as openWebview } from '../views/webview';

function startRecall () {
  return openWebview();
}


/**
 * Returns a command url usable in Markdown strings.
 * 
 * @param commandName Second part of the command name, will be prefixed with recall.
 * @param params Array of arguments. They will be url encoded.
 */
const createCommandUrl = (commandName, ...params) => {
  const encodedParams = encodeURIComponent(JSON.stringify(params));
  return vscode.Uri.parse(`command:recall.${commandName}?${encodedParams}`);
};

/* EXPORT */

export {
  createCommandUrl, startRecall,
};
