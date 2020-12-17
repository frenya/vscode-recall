
/* IMPORT */

import * as vscode from 'vscode';
import Config from './config';
import Consts from './consts';
import Decorators from './decorators';
import Utils from './utils';
import { open as openWhatsNew } from './views/whatsnew';

// import ViewEmbedded from './views/embedded';

/* ACTIVATE */

const activate = function ( context: vscode.ExtensionContext ) {

  // ViewEmbedded.expanded = Config(null).get('expanded');

  Utils.context = context;
  Utils.folder.initRootsRe ();

  Utils.embedded.initProvider();

  Decorators.init(context);

  context.subscriptions.push (
    vscode.workspace.onDidChangeConfiguration ( () => Utils.embedded.provider && delete Utils.embedded.provider.filesData ),
    vscode.workspace.onDidChangeWorkspaceFolders ( () => Utils.embedded.provider && Utils.embedded.provider.unwatchPaths () ),
    vscode.workspace.onDidChangeWorkspaceFolders ( Utils.folder.initRootsRe )
  );

  // Init commands
  Utils.init.commands ( context );

  openWhatsNew();
};

const deactivate = function () {

};

  /* EXPORT */

export {activate, deactivate};
