
/* IMPORT */

import * as vscode from 'vscode';
import Config from './config';
import Consts from './consts';
import Utils from './utils';
import ViewEmbedded from './views/embedded';

/* ACTIVATE */

const activate = function ( context: vscode.ExtensionContext ) {

  ViewEmbedded.expanded = Config(null).get('expanded');

  // Render Markdown using internal markdown-it instance
  // Undocumented, https://github.com/microsoft/vscode/issues/75612
  // vscode.commands.executeCommand ( 'markdown.api.render', '# Header 1' ).then(console.log);
  
  Utils.context = context;
  Utils.folder.initRootsRe ();
  Utils.init.views ();

  context.subscriptions.push (
    vscode.workspace.onDidChangeConfiguration ( () => Utils.embedded.provider && delete Utils.embedded.provider.filesData ),
    vscode.workspace.onDidChangeWorkspaceFolders ( () => Utils.embedded.provider && Utils.embedded.provider.unwatchPaths () ),
    vscode.workspace.onDidChangeWorkspaceFolders ( Utils.folder.initRootsRe )
  );

  // Init commands
  Utils.init.commands ( context );
};

const deactivate = function () {

  Utils.embedded.provider.history.destructor();

}

  /* EXPORT */

export {activate, deactivate};
