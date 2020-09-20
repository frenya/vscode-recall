
/* IMPORT */

import * as _ from 'lodash';
import * as vscode from 'vscode';
import * as Commands from '../commands';
import Views from '../views';

/* INIT */

const Init = {

  commands ( context: vscode.ExtensionContext ) {

    const {commands} = vscode.extensions.getExtension ( 'frenya.vscode-recall' ).packageJSON.contributes;

    commands.forEach ( ({ command, title }) => {

      const commandName = _.last ( command.split ( '.' ) ) as string,
            handler = Commands[commandName],
            disposable = vscode.commands.registerCommand ( command, handler );

      if (!handler) console.warn('No handler found for command', command);

      context.subscriptions.push ( disposable );

    });

    return Commands;

  },

  views () {

    Views.forEach ( View => {
      vscode.window.registerTreeDataProvider ( View.id, View );
    });

    vscode.workspace.onDidChangeConfiguration ( () => {
      Views.forEach ( View => View.refresh () );
    });

  }

};

/* EXPORT */

export default Init;
