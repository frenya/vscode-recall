
/* IMPORT */

import * as vscode from 'vscode';
import Utils from '../../utils';

/* ITEM */

class Item extends vscode.TreeItem {

  obj;
  contextValue = 'item';

  constructor ( obj, label, collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None ) {

    super ( label, collapsibleState );

    this.obj = obj;

  }

}

/* EXPORT */

export default Item;
