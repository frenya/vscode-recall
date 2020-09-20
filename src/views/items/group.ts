import * as _ from 'lodash';
import * as vscode from 'vscode';
import Item from './item';

class Group extends Item {

  contextValue = 'group';

  constructor(obj, label) {
    super (obj, label, vscode.TreeItemCollapsibleState.Expanded);
    
    // The child with task array
    const children = obj[''];
    if (_.isArray (children)) {
      this.label = `${label} (${children.length})`;
    }
  }

}

export default Group;
