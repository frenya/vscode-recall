
/* IMPORT */

import * as _ from 'lodash';
import * as path from 'path';
import * as vscode from 'vscode';
import stringMatches from 'string-matches';
import Config from '../../../config';
import Consts from '../../../consts';
import File from '../../file';
import Folder from '../../folder';
import Abstract, { pathNormalizer, TaskType } from './abstract';
import { isItMyself, mySyncSettings } from '../../../commands/mentions';
const metadataParser = require('markdown-yaml-metadata-parser');

const dateRegex = /\s[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}/;
const linkRegex = Consts.regexes.emptyLink;

/* JS */

class JS extends Abstract {

  async getFilePaths ( rootPaths ) {

    const globby = require ( 'globby' ); // Lazy import for performance

    return _.flatten ( await Promise.all ( rootPaths.map ( cwd => globby ( this.include, { cwd, ignore: this.exclude, dot: true, absolute: true } ) ) ) );

  }

  async initFilesData ( rootPaths ) {

    const filePaths = await this.getFilePaths ( rootPaths );

    this.filesData = {};

    await Promise.all ( _.map ( filePaths, async ( filePath: string ) => {

      this.filesData[pathNormalizer(filePath)] = await this.getFileData ( pathNormalizer(filePath) );

    }));

  }

  async updateFilesData () {

    if ( _.isEmpty ( this.filesData ) ) return;

    await Promise.all ( _.map ( this.filesData, async ( val, filePath ) => {

      if ( val ) return;

      this.filesData[pathNormalizer(filePath)] = await this.getFileData ( pathNormalizer(filePath) );

    }));

  }

  async getFileData ( filePath ): Promise<TaskType[]> {

    console.log('Parsing file ', filePath);

    let data = [];
    let content = await File.read ( filePath );

    // Get config for the file
    const fileUri = vscode.Uri.file(filePath);
    const config = Config(fileUri);
    console.log(config);

    // Parse YAML header (if present), split content and metadata
    const result = metadataParser(content);
    console.log(filePath, JSON.stringify(result.metadata));
    content = result.content;

    // Determine the level at which cards are recognized
    // i.e. the regex to use to detect card starts
    const recall = result.metadata.recall || config.get('defaultLevel') || 'header';
    const cardRegex = Consts.cardRegexes[recall];
    
    // Sanity check
    if ( !content || !cardRegex ) return data;

    // Find the card starts in the current file
    const matches = stringMatches ( content, cardRegex );

    // console.log(matches);
    if ( !matches.length ) return data;

    matches.forEach ( (match, i) => {
      // console.log('Parsing match', match, match.index, content.length)
      let nextCardStart = i + 1 < matches.length ? matches[i + 1].index : content.length;
      let cardText = _.trim(content.substring(match.index, nextCardStart).replace(cardRegex, '$1'));

      // console.log(cardText);

      // Split by empty line
      let cardPages = cardText.split ( /\r?\n\r?\n/ ).map(text => _.trim(text));

      if (cardPages.length === 1) {
        // Card only has one page. Let's try to split it by a special character
        cardPages = cardText.split(':').map(text => _.trim(text));
      }

      // Only push the cards that do have two or more pages
      if (cardPages.length > 1) data.push (cardPages);
    });

    console.log(data);
    return data;

  }

  async getFileDataOld ( filePath ): Promise<TaskType[]> {

    const data = [],
          content = await File.read ( filePath );

    if ( !content ) return data;

    const lines = content.split ( /\r?\n/ );

    const fileUri = vscode.Uri.file(filePath);
    const config = Config(fileUri);
    let defaultOwner = '<unassigned>';

    const parsedPath = Folder.parsePath ( filePath );
    if (parsedPath.relativePath.startsWith('@')) defaultOwner = path.basename(filePath, path.extname(filePath));

    lines.forEach ( ( rawLine, lineNr ) => {

      const line = _.trimStart ( rawLine ),
            matches = stringMatches ( line, Consts.regexes.todoEmbeddedGlobal );

      if ( !matches.length ) return;

      matches.forEach ( match => {
        let owner = match[1].trim();
        let username = owner.substr(1) || defaultOwner;
        let task: TaskType = {
          todo: match[0],
          owner: owner || defaultOwner,
          myself: false,
          message: match[2],
          code: line.slice ( 0, line.indexOf ( match[0] ) ),
          rawLine,
          line,
          lineNr,
          filePath,
          root: parsedPath.root,
          rootPath: parsedPath.rootPath,
          relativePath: parsedPath.relativePath
        };

        this.extractRegex(task, dateRegex, 0, 'dueDate');
        this.extractRegex(task, linkRegex, 1, 'externalURL');
        this.extractRegex(task, Consts.regexes.label, 1, 'label');

        // Detect "my" tasks
        task.myself = isItMyself(config, username); // TODO: Maybe useless, could be replaced with !!task.sync
        task.sync = mySyncSettings(config, username);

        // Add document backlink
        task.backlinkURL = `vscode://file/${encodeURIComponent(task.filePath)}:${task.lineNr+1}`;

        data.push (task);
      });

    });

    return data;

  }

  // Extract a regex from obj.message, store it in attribute name
  extractRegex (obj: TaskType, regex: RegExp, group: number, attributeName: string): TaskType {

    // Detect due date
    let match = regex.exec(obj.message);
    if (match && match.length > group) obj[attributeName] = match[group].trim();

    // Remove the regex from message
    obj.message = obj.message.replace(regex, '').trim();

    return obj;

  }

}

/* EXPORT */

export default JS;
