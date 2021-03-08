
/* IMPORT */

import * as _ from 'lodash';
import * as vscode from 'vscode';
import Config, { myExtension } from '../../../config';
import File from '../../file';
import Folder from '../../folder';

/* ABSTRACT */

export const pathNormalizer = filePath => filePath.replace ( /\\/g, '/' ).normalize();

class Abstract {

  include = undefined;
  exclude = undefined;
  rootPaths = undefined;
  filesData = undefined;
  watchers: vscode.FileSystemWatcher[] = [];

  globMatch: Function = null;

  filesDataChanged: vscode.EventEmitter<any> = new vscode.EventEmitter ();
  onFilesDataChanged: vscode.Event<any> = this.filesDataChanged.event;

  constructor () {

    this.rootPaths = _.castArray(Folder.getAllRootPaths ());

    const config = Config(null);
    this.include = config.get('include');
    this.exclude = config.get('exclude');

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`${myExtension}.include`) || e.affectsConfiguration(`${myExtension}.exclude`)) {
        console.warn('Glob patterns changes deleting cached file data');
        this.filesData = undefined;
      }
      else if (e.affectsConfiguration(myExtension)) {
        // TODO: Invalidate content when other settings change
        console.warn(myExtension, 'configuration change ignored');
      }
    });

  }

  //#region Watching

  async watchPaths () {
    const invalidate = (filePath, content) => {
      console.warn('Invalidating file', filePath);
      if (!this.isIncluded(filePath)) return;
      this.invalidateFileData(pathNormalizer(filePath), content);
    };

    this.include.forEach ( glob => {
      let watcher = vscode.workspace.createFileSystemWatcher ( glob );

      watcher.onDidCreate( e => invalidate(e.fsPath, null) );
      watcher.onDidChange( e => invalidate(e.fsPath, null) );

      // Populating the file with empty content is as good as deleting
      watcher.onDidDelete( e => invalidate(e.fsPath, '') );

      this.watchers.push(watcher);
    });
  }

  unwatchPaths () {
    this.watchers.forEach(watcher => watcher.dispose());
    this.watchers = [];
  }

  isIncluded ( filePath ) {
    if (!this.globMatch) {
      const mm = require ( 'micromatch' ); // Lazy import for performance
      this.globMatch = mm.matcher(this.include, { ignore: this.exclude, dot: true });
    }

    return !!this.globMatch(filePath);
  }

  //#endregion

  /**
   * Initialized the .filesData object with undefined attributes corresponding with the relevant file paths.
   * Must be followed by updateFilesData to actually contain the tasks.
   */
  async initFilesData () {
    const globby = require ( 'globby' ); // Lazy import for performance
    const filePaths = _.flatten ( await Promise.all ( this.rootPaths.map ( cwd => globby ( this.include, { cwd, ignore: this.exclude, dot: true, absolute: true } ) ) ) );

    // This creates a map of url's to file data i.e. an object like { <filePath>: any }
    // with the values of all attributes set to "undefined"
    //
    // In other words, at the beginning, all applicable files are recorded but their content is invalidated
    this.filesData = _.zipObject(_.map(filePaths, pathNormalizer), []);

    // console.log('Initialized filesData', this.filesData);
  }

  /**
   * Populate filesData with actual parsed content and return the resulting object.
   * This method is immune to this.filesData being reset in the process.
   * 
   * @param {Function} filterFn File path filter function. If it returns false, file is skipped.
   */
  async getFilesData (filterFn?: Function) {
    // Initialize filesData if necessary
    if (!this.filesData) {
      this.unwatchPaths ();
      await this.initFilesData();
      this.watchPaths ();  
    }

    // Store local reference to filesData since the class atribute may get overwritten
    // console.log('Using filesData', JSON.stringify(this.filesData));
    let filesData = this.filesData;

    await Promise.all (_.map(filesData, async (val, filePath /* already normalized */) => {
      // Only attributes (filenames) with no value need updating
      if ( val ) return;

      // Don't waste time parsing any files that would be filtered out anyway
      if (filterFn && !filterFn(filePath)) return;

      // Extract tasks from file and update value
      filesData[filePath] = await this.extractFileData(filePath);
    }));

    return filterFn ? _.pickBy(filesData, (val, key) => filterFn(key)) : filesData;
  }

  /**
   * Populate filesData with actual parsed content and return the resulting object.
   * This method is immune to this.filesData being reset in the process.
   */
  async getFileData (filePath) {
    // Initialize filesData if necessary
    if (!this.filesData) {
      this.unwatchPaths ();
      await this.initFilesData();
      this.watchPaths ();  
    }

    filePath = pathNormalizer(filePath);
    return this.filesData[filePath] || await this.extractFileData(filePath);
  }

  // Method to emit debounced refresh event
  refresh = _.debounce (() => { this.filesDataChanged.fire(null); }, 750);

  invalidateFileData (filePath, content) {
    // Sanity check (in case this.filesData hasn't been initialized yet)
    if (!this.filesData) return;

    filePath = pathNormalizer(filePath);

    // If content was provided, parse it and store it
    if (content == null) this.filesData[filePath] = undefined; // tslint:disable-line:triple-equals 
    else {
      const parsedPath = Folder.parsePath(filePath);
      this.filesData[filePath] = this.parseContent(content, this.filesData[filePath] || this.emptyFileData(filePath));
    }

    this.refresh();

    return this.filesData[filePath];
  }

  // Override to add extra elements, such as config attributes
  // using Config(vscode.Uri.file(filePath));
  emptyFileData (filePath) {
    return Folder.parsePath(filePath);
  }

  /**
   * Load file content from disk and update file data
   * @param filePath Normalized file path of the document to process
   * @returns Object file metadata and parsed content 
   */
  async extractFileData ( filePath ): Promise<Object> {
    console.log('Parsing file ', filePath);
    let content = await File.read ( filePath );
    return this.invalidateFileData(filePath, content);
  }

  /**
   * This method is responsible for parsing the content and returning whatever
   * data structure the extension needs for further processing.
   * 
   * @param {String} content the content of the file (e.g. Markdown text including YAML front matter)
   * @param {Object} fileData the original fileData object
   * @returns The fileData object populated by the parsed content in .data plus optional metadata extracted from the YAML front matter
   */
  parseContent (content, fileData): any {
    return {
      ...fileData,
      data: [],
    };
  }

}

/* EXPORT */

export default Abstract;
