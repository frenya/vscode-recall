
/* IMPORT */

import * as _ from 'lodash';
import * as vscode from 'vscode';
import * as Commands from '../commands';
import Utils from '../utils';

/* INIT */

const Init = {

  commands ( context: vscode.ExtensionContext ) {

    const {commands} = vscode.extensions.getExtension ( 'frenya.vscode-recall' ).packageJSON.contributes;

    commands.forEach ( ({ command, title }) => {

      const commandName = _.last ( command.split ( '.' ) ) as string,
            handler = Commands[commandName],
            disposable = vscode.commands.registerCommand ( command, Utils.reporter.commandWrapper(commandName, handler) );

      if (!handler) console.warn('No handler found for command', command);

      context.subscriptions.push ( disposable );

    });

    // Test - internal command
    vscode.commands.registerCommand ( 'recall.findChecksums', Commands['findChecksums'] );
    vscode.commands.registerCommand ( 'recall.archiveCard', Commands['archiveCard'] );
    vscode.commands.registerCommand ( 'recall.logCardToConsole', Commands['logCardToConsole'] );

    return Commands;

  },

};

/* EXPORT */

export default Init;
