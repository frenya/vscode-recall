
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
const metadataParser = require('markdown-yaml-metadata-parser');
const md5 = require('md5');

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

    // console.log('Parsing file ', filePath);

    let data = [];
    let content = await File.read ( filePath );

    // Get config for the file
    const fileUri = vscode.Uri.file(filePath);
    const config = Config(fileUri);
    const parsedPath = Folder.parsePath ( filePath );
    // console.log(config);

    // Parse YAML header (if present), split content and metadata
    const result = metadataParser(content);
    console.log(filePath, JSON.stringify(result.metadata));
    content = result.content;

    // Determine the level at which cards are recognized
    // i.e. the regex to use to detect card starts
    const recall = result.metadata.recall || config.get('defaultLevel') || 'header';
    const cardRegex = Consts.cardRegexes[recall];
    const lineDivider:string = config.get('lineDivider') || ':';
    
    // Sanity check
    if ( !content || !cardRegex ) return data;

    // Find the card starts in the current file
    const matches = stringMatches ( content, cardRegex );

    // console.log(matches);
    if ( !matches.length ) return data;

    // Initialize history
    await this.history.addFolder(parsedPath.rootPath);

    matches.forEach ( (match, i) => {
      // console.log('Parsing match', match, match.index, content.length)
      let nextCardStart = i + 1 < matches.length ? matches[i + 1].index : content.length;
      let cardText = _.trim(content.substring(match.index, nextCardStart).replace(cardRegex, '$1'));

      // Quick and dirty - distinguish the type of card
      const isHeader = content[match.index] === '#';

      // console.log(cardText);

      // Split by empty line
      let cardPages = cardText.split ( /\r?\n\r?\n/ ).map(text => _.trim(text));

      if (!isHeader) {
        // Card is a bullet point. Let's try to split it by a special character
        cardPages = cardText.split(lineDivider).map(text => _.trim(text));

        // Also, split the last page by the first newline
        let lastPage = cardPages.pop();
        let splitPages = lastPage.split ( /\r?\n/ ).map(text => _.trim(text));

        cardPages.push(splitPages.shift());
        cardPages.push(splitPages.join('\n'));
      }

      // Filter out empty pages
      cardPages = cardPages.filter(text => !!_.trim(text));

      // Only push the cards that do have two or more pages
      if (cardPages.length > 1) {
        const card = {
          pages: cardPages,
          filePath,
          root: parsedPath.root,
          rootPath: parsedPath.rootPath,
          relativePath: parsedPath.relativePath,
          checksum: md5(cardPages.join('\n')),
          nextReviewDate: 0,
          recall: 1,
        };

        this.history.getCardRecall(card);

        data.push(card);
        this.queue.push(card);
      }
    });

    console.log(data);
    return data;
  }

}

/* EXPORT */

export default JS;
