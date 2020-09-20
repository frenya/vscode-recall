
/* IMPORT */

import * as _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import ItemTodo from '../views/items/todo';
import Utils from '../utils';
import ViewEmbedded from '../views/embedded';

import { toggleTodo, toggleDone } from './toggle';
import { syncFile, showTasks } from './sync';
import { createMention, addMentionDetail } from './mentions';

/* VIEW */

function viewRevealTodo ( todo: ItemTodo ) {

  if ( todo.obj.todo ) {

    const startIndex = todo.obj.rawLine.indexOf ( todo.obj.todo ),
          endIndex = startIndex + todo.obj.todo.length;

    Utils.file.open ( todo.obj.filePath, true, todo.obj.lineNr, startIndex, endIndex );

  } else {

    Utils.file.open ( todo.obj.filePath, true, todo.obj.lineNr );

  }

}

function openTaskURL ( todo: ItemTodo ) {
  // console.log(todo);
  vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(todo.obj.externalURL));
}



/* VIEW EMBEDDED */

function viewEmbeddedCollapse () {
  ViewEmbedded.expanded = false;
  vscode.commands.executeCommand ( 'setContext', 'todo-embedded-expanded', false );
  ViewEmbedded.refresh ( true );
}

function viewEmbeddedExpand () {
  ViewEmbedded.expanded = true;
  vscode.commands.executeCommand ( 'setContext', 'todo-embedded-expanded', true );
  ViewEmbedded.refresh ( true );
}

async function viewEmbeddedFilter () {

  const filter = await vscode.window.showInputBox ({ placeHolder: 'Filter string...' });

  if ( !filter || ViewEmbedded.filter === filter ) return;

  ViewEmbedded.filter = filter;
  ViewEmbedded.filterRe = filter ? new RegExp ( _.escapeRegExp ( filter ), 'i' ) : false;
  vscode.commands.executeCommand ( 'setContext', 'todo-embedded-filtered', true );
  ViewEmbedded.refresh ();

}

function viewEmbeddedClearFilter () {
  ViewEmbedded.filter = false;
  ViewEmbedded.filterRe = false;
  vscode.commands.executeCommand ( 'setContext', 'todo-embedded-filtered', false );
  ViewEmbedded.refresh ();
}

async function viewEmbeddedFilterByOwner (owner) {

  // tslint:disable-next-line:triple-equals
  if (owner == null) {
    owner = await vscode.window.showInputBox ({ value: ViewEmbedded.filterOwner });
    // tslint:disable-next-line:triple-equals
    if (owner == null) return;
    else owner = owner || '<unassigned>';
  }

  // Avoid unnecessary refreshes
  if ( ViewEmbedded.filterOwner === owner ) return;

  ViewEmbedded.filterOwner = owner;
  vscode.commands.executeCommand ( 'setContext', 'todo-embedded-filtered-owner', !!owner );
  if (owner) {
    ViewEmbedded.expanded = true;
    vscode.commands.executeCommand ( 'setContext', 'todo-embedded-expanded', true );
  }
  ViewEmbedded.refresh ( true );

}

async function viewEmbeddedFilterMyTasks () {
  viewEmbeddedFilterByOwner('<me>');
}

async function viewEmbeddedFilterAllTasks () {
  viewEmbeddedFilterByOwner('');
}

async function viewEmbeddedFilterByDate () {

  const filter = await vscode.window.showInputBox ({ value: new Date().toISOString().substr(0, 10) });
  // tslint:disable-next-line:triple-equals
  if (filter != null) viewEmbeddedDueTasks(filter || '2999-12-31');

}

async function viewEmbeddedDueTasks (date) {

  // Avoid unnecessary refreshes
  if ( ViewEmbedded.filterDueDate === date ) return;

  ViewEmbedded.filterDueDate = date;
  vscode.commands.executeCommand ( 'setContext', 'todo-embedded-filtered-due', !!date );
  if (date) {
    ViewEmbedded.expanded = true;
    vscode.commands.executeCommand ( 'setContext', 'todo-embedded-expanded', true );
  }
  ViewEmbedded.refresh ( true );

}

async function viewEmbeddedDueToday () {
  viewEmbeddedDueTasks(new Date().toISOString().substr(0, 10));
}

async function viewEmbeddedDueAnytime () {
  viewEmbeddedDueTasks(null);
}


async function viewEmbeddedShowLinkedTasks () {

  ViewEmbedded.hideLinked = false;
  vscode.commands.executeCommand ( 'setContext', 'todo-embedded-hide-linked', false );
  ViewEmbedded.refresh ( true );

}

async function viewEmbeddedHideLinkedTasks () {

  ViewEmbedded.hideLinked = true;
  vscode.commands.executeCommand ( 'setContext', 'todo-embedded-hide-linked', true );
  ViewEmbedded.refresh ( true );

}

/* FILE CREATION */

async function newFile () {

  const title = await vscode.window.showInputBox ({ placeHolder: 'Note title [, Folder]' });

  // Sanity check (null means Esc was pressed)
  // tslint:disable-next-line:triple-equals
  if (title == null) return;

  const comps = title.split(',');

  let folder = Utils.folder.getRootPath();
  let name = comps[0].trim() || 'Untitled';
  let suffix: any = '';

  if (comps.length > 1) {
    const paths = Utils.folder.getAllRootPaths();
    folder = paths.find((p: string) => path.basename(p).toLowerCase().startsWith(comps[1].trim().toLowerCase())) || folder;
  }

  // Get current date
  let date = new Date().toISOString().substr(0, 10);

  // SNIPPET
  // Find first non-colliding name
  while (fs.existsSync(`${folder}/${date} ${name}${suffix}.md`)) {
    suffix = (suffix || 0) - 1;
  }

  var uri: vscode.Uri = vscode.Uri.parse(`untitled:${folder}/${date} ${name}${suffix}.md`);
  vscode.workspace.openTextDocument(uri).then((doc: vscode.TextDocument) => {
      vscode.window.showTextDocument(doc, 1, false).then(e => {
          if (name !== 'Untitled') {
            e.edit(edit => { edit.insert(new vscode.Position(0, 0), `# ${name}\n\n`); });
          }
      });
  }, (error: any) => {
      console.error(error);
      debugger;
  });
}

/**
 * Returns a command url usable in Markdown strings.
 * 
 * @param commandName Second part of the command name, will be prefixed with recall.
 * @param params Array of arguments. They will be url encoded.
 */
const createCommandUrl = (commandName, ...params) => {
  const encodedParams = encodeURIComponent(JSON.stringify(params));
  return vscode.Uri.parse(`command:recall.${commandName}?${encodedParams}`);
};

/* EXPORT */

export {
  viewRevealTodo, viewEmbeddedCollapse, viewEmbeddedExpand, 
  viewEmbeddedFilter, viewEmbeddedClearFilter, 
  openTaskURL, newFile, 
  toggleTodo, toggleDone,
  viewEmbeddedFilterMyTasks, viewEmbeddedFilterAllTasks, viewEmbeddedFilterByOwner,
  viewEmbeddedDueToday, viewEmbeddedDueAnytime, viewEmbeddedFilterByDate,
  viewEmbeddedShowLinkedTasks, viewEmbeddedHideLinkedTasks,
  syncFile, showTasks,
  createMention, addMentionDetail,
  createCommandUrl,
};
