// import * as _ from 'lodash';
import * as vscode from 'vscode';

export const myExtension = 'recall';

let Config = (uri: vscode.Uri) => vscode.workspace.getConfiguration(myExtension, uri);

export default Config;
