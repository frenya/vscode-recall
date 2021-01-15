
/* IMPORT */

import * as vscode from 'vscode';
import Config from './config';
import Consts from './consts';
import Utils from './utils';
import Decorators from './decorators';
import { open as openWhatsNew } from './views/whatsnew';

/* ACTIVATE */

const activate = function ( context: vscode.ExtensionContext ) {

  Utils.context = context;
  Utils.folder.initRootsRe ();

  Utils.embedded.initProvider();

  Decorators.init(context);

  context.subscriptions.push (
    vscode.workspace.onDidChangeWorkspaceFolders ( () => Utils.embedded.provider && Utils.embedded.provider.unwatchPaths () ),
    vscode.workspace.onDidChangeWorkspaceFolders ( Utils.folder.initRootsRe )
  );

  // Init commands
  Utils.init.commands ( context );

  openWhatsNew();
};

/* EXPORT */

export {activate};
