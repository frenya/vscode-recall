
/* IMPORT */

import * as vscode from 'vscode';

import embedded from './embedded';
import file from './file';
import folder from './folder';
import init from './init';
import view from './view';

/* UTILS */

const Utils = {
  context: <vscode.ExtensionContext> undefined,
  embedded,
  file,
  folder,
  init,
  view,

  // Webview panel
  panel: null,

  getContextValue: function (key) { 
    return this.context.globalState.get(key);
  },

  setContextValue: function (key, value) {
    return this.context.globalState.update(key, value); 
  },

};

/* EXPORT */

export default Utils;
