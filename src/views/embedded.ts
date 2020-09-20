
/* IMPORT */

import * as _ from 'lodash';
import * as vscode from 'vscode';
import Utils from '../utils';
import File from './items/file';
import Item from './items/item';
import Group from './items/group';
import Placeholder from './items/placeholder';
import Todo from './items/todo';
import View from './view';

/* EMBEDDED */

//TODO: Collapse/Expand without rebuilding the tree https://github.com/Microsoft/vscode/issues/54192

class Embedded extends View {

  // This corresponds to the view's id defined in package.json
  id = 'recall.views.coffeeBreak';
  
  clear = false;
  expanded = true;
  filter: string | false = false;
  filterRe: RegExp | false = false;
  filterOwner: string = '';
  filterDueDate: string | false = false;
  hideLinked = false;

  getTreeItem ( item: Item ): vscode.TreeItem {

    if ( item.collapsibleState !== vscode.TreeItemCollapsibleState.None ) {
      item.collapsibleState = this.expanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
    }

    return item;

  }

  async getEmbedded () {

    await Utils.embedded.initProvider ();

    return await Utils.embedded.provider.get ( undefined, this.isItemVisible.bind(this) );

  }

  isItemVisible (obj) {
    // Filter linked
    if (this.hideLinked && obj.externalURL) return false;

    // Filter by owner if applicable
    if (this.filterOwner) {
      if (this.filterOwner === '<me>') {
        if(!obj.myself) return false;
      }
      else if (obj.owner !== this.filterOwner) return false;
    }

    // Filter by due date if applicable
    if (this.filterDueDate && (!obj.dueDate || obj.dueDate > this.filterDueDate)) return false;

    // Filter by text if applicable
    if (this.filterRe && !this.filterRe.test(obj.message)) return false;

    return true;
  }

  async getChildren ( item?: Item ): Promise<Item[]> {

    if ( this.clear ) {

      setTimeout ( this.refresh.bind ( this ), 0 );

      return [];

    }

    // Check the item's data or load the whole tree when item is null (i.e. rendering root)
    let obj = item ? item.obj : await this.getEmbedded ();

    // Collapse unnecessary groups
    while ( obj && '' in obj ) obj = obj[''];

    if ( _.isEmpty ( obj ) ) return [new Placeholder ( 'No embedded todos match filter criteria' )];

    if ( _.isArray ( obj ) ) {
      return obj.map(obj => new Todo ( obj, obj.message, true ));
    }
    else if ( _.isObject ( obj ) ) {
      const keys = Object.keys ( obj ).sort ();
      return keys.map ( key => new Group(obj[key], key));
    }

  }

  refresh ( clear? ) {

    this.clear = !!clear;

    super.refresh ();

  }

}

/* EXPORT */

export default new Embedded ();
