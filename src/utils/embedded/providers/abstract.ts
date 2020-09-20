
/* IMPORT */

import * as _ from 'lodash';
import * as querystring from 'querystring';
import * as vscode from 'vscode';
import Config from '../../../config';
import EmbeddedView from '../../../views/embedded';
import Folder from '../../folder';

/* ABSTRACT */

export const pathNormalizer = filePath => filePath.replace ( /\\/g, '/' ).normalize();

/**
 * Type of task extracted from a Markdown document.
 */
export interface TaskType {
  todo: string;

  /** Task owner mention (including the "@"" character) */
  owner: string;

  /** True when task owner matches workspace user */
  myself: boolean;

  /** This is the actual text of the task (without the user mention) */
  message: string;
  code: string;

  /** Line in the original document including all whitespace */
  rawLine: string;

  line: string;

  /** Line number in the document, zero based */
  lineNr: number;

  /** Fully qualified file path */
  filePath: string;

  /** Workspace folder name */
  root: string;

  /** Workspace folder path */
  rootPath: string;

  /** Relative path of the document within its workspace folder */
  relativePath: string;

  /** Due date string in the YYYY-MM-DD format */
  dueDate?: string;

  /** When synced to external service, the url identifying the task in the external service */
  externalURL?: string;

  /** Link to the line in the original document */
  backlinkURL?: string;

  /** Local sync settings (combination of workspace, folder and task owner's settings) */
  sync?: {
    command?: string;
  };
}


class Abstract {

  include = undefined;
  exclude = undefined;
  rootPaths = undefined;
  filesData = undefined; // { [filePath]: todo[] | undefined }
  watcher: vscode.FileSystemWatcher = undefined;

  async get ( rootPaths = Folder.getAllRootPaths (), filter ) {

    rootPaths = _.castArray ( rootPaths );

    const config = Config(null);
    this.include = config.get('include');
    this.exclude = config.get('exclude');

    if ( !this.filesData || !_.isEqual ( this.rootPaths, rootPaths ) ) {

      this.rootPaths = rootPaths;
      this.unwatchPaths ();
      await this.initFilesData ( rootPaths );
      this.watchPaths ();

    } else {

      await this.updateFilesData ();

    }

    return this.getTodos ( filter );

  }

  async watchPaths () {

    /* HANDLERS */

    const refresh = _.debounce ( () => EmbeddedView.refresh (), 250 );

    const add = event => {
      if ( !this.filesData ) return;
      const filePath = pathNormalizer ( event.fsPath );
      if ( this.filesData.hasOwnProperty ( filePath ) ) return;
      if ( !this.isIncluded ( filePath ) ) return;
      this.filesData[filePath] = undefined;
      refresh ();
    };

    const change = event => {
      if ( !this.filesData ) return;
      const filePath = pathNormalizer ( event.fsPath );
      if ( !this.isIncluded ( filePath ) ) return;
      this.filesData[filePath] = undefined;
      refresh ();
    };

    const unlink = event => {
      if ( !this.filesData ) return;
      const filePath = pathNormalizer ( event.fsPath );
      delete this.filesData[filePath];
      refresh ();
    };

    /* WATCHING */

    this.include.forEach ( glob => {

      this.watcher = vscode.workspace.createFileSystemWatcher ( glob );

      this.watcher.onDidCreate ( add );
      this.watcher.onDidChange ( change );
      this.watcher.onDidDelete ( unlink );

    });

  }

  unwatchPaths () {

    if ( !this.watcher ) return;

    this.watcher.dispose ();

  }

  getIncluded ( filePaths ) {

    const micromatch = require ( 'micromatch' ); // Lazy import for performance

    return micromatch ( filePaths, this.include, { ignore: this.exclude, dot: true } );

  }

  isIncluded ( filePath ) {

    return !!this.getIncluded ([ filePath ]).length;

  }

  async initFilesData ( rootPaths ) {

    this.filesData = {};

  }

  async updateFilesData () {}

  getTodos ( filter ) {

    if ( _.isEmpty ( this.filesData ) ) return;

    const todos = {}, // { [ROOT] { [TYPE] => [DATA] } }
          filePaths = Object.keys ( this.filesData );

    const addTodo = (todo, root, owner) => {
      if (!todos[root]) todos[root] = {};
      if (!todos[root][owner]) todos[root][owner] = [];
      todos[root][owner].push(todo);
    };

    filePaths.map(pathNormalizer).forEach ( filePath => {
      // Get the tasks in a file, return if empty
      const data = this.filesData[filePath];
      if ( !data || !data.length ) return;

      data.forEach ( datum => {
        if ( filter && !filter(datum) ) return;

        addTodo(datum, datum.root || '', datum.owner || '');

        // Use labels to add the task to other folders too
        if (datum.label) {
          addTodo(datum, datum.label, datum.owner || '');
          if ( !todos[datum.label] ) todos[datum.label] = {};
        }
      });

    });

    const roots = Object.keys ( todos );

    return roots.length > 1 ? todos : { '': todos[roots[0]] };

  }

}

/* EXPORT */

export default Abstract;
