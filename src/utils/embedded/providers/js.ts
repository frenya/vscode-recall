
/* IMPORT */

import * as _ from 'lodash';
import * as vscode from 'vscode';
import stringMatches from 'string-matches';
import Config from '../../../config';
import Consts from '../../../consts';
import Abstract, { pathNormalizer } from './abstract';
const metadataParser = require('markdown-yaml-metadata-parser');
const md5 = require('md5');
import History from './history';

/* JS */

class JS extends Abstract {

  history: History;

  constructor() {
    super();
    this.history = new History();
  }

  parseContent (content, fileData) {
    fileData.data = [];

    // Get config for the file
    const fileUri = fileData.filePath ? vscode.Uri.file(fileData.filePath) : null;
    const config = Config(fileUri);
    // console.log(config);

    // Parse YAML header (if present), split content and metadata
    const result = metadataParser(content);
    const contentOffset = content.length - result.content.length;
    content = result.content;

    // Determine the level at which cards are recognized
    // i.e. the regex to use to detect card starts
    const recall = result.metadata.recall || config.get('defaultLevel') || 'header';
    const cardRegex = Consts.cardRegexes[recall];
    const lineDivider:string = config.get('lineDivider') || ':';
    
    // Sanity check
    if ( !content || !cardRegex ) return fileData;

    // Find the card starts in the current file
    const matches = stringMatches ( content, cardRegex );

    // console.log(matches);
    if ( !matches.length ) return fileData;

    // Header hierarchy stack (null is for "header 0")
    let headerStack = [null];

    matches.forEach ( (match, i) => {
      // console.log('Parsing match', match, match.index, content.length)
      let nextCardStart = i + 1 < matches.length ? matches[i + 1].index : content.length;
      let cardType = _.trim(match[0]);
      let cardText = _.trim(content.substring(match.index, nextCardStart).replace(cardRegex, '# '));

      // Quick and dirty - distinguish the type of card
      const isHeader = cardType[0] === '#';

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
      else {
        // Update the header stack
        // Remove all irrelevant headers
        headerStack.splice(cardType.length);
      }

      // Filter out empty pages
      cardPages = cardPages.filter(text => !!_.trim(text));

      // Only push the cards that do have two or more pages
      if (cardPages.length > 1) {
        const card = {
          pages: cardPages,
          offset: contentOffset + match.index,
          cardType: cardType,
          headerPath: _.compact(headerStack),
          checksum: md5(cardPages.join('\n')),
          checksumPure: md5(cardPages.map(x => x.replace(cardRegex, '')).join('\n')),
          nextReviewDate: Math.random() * 1000,   // To randomize the review of new cards as well
          recall: 0,
        };
        
        fileData.data.push(card);
      }

      // Store header on stack
      if (isHeader) {
        headerStack = padArray(headerStack, cardType.length);
        headerStack.push(cardPages[0].replace(cardRegex, ''));
        // console.log('Header stack:', headerStack);
      }
    });

    console.log(fileData);
    return fileData;
  }

  async getCards (filterFn?: Function) {
    const filesData = await this.getFilesData(filterFn);

    const cardDecks = await Promise.all(Object.keys(filesData).map(async filePath => {
      return await this.getCardsFromFileData(filesData[filePath]);
    }));

    return _.concat([], ...cardDecks);
  }

  async getCardsFromFileData (fileData) {
    // Initialize history
    await this.history.addFolder(fileData.rootPath);

    return fileData.data.map(card => {
      Object.assign(card, fileData);
      this.history.getCardRecall(card)
        .then(() => { card.state = this.getCardState(card); });
      return card;
    });
  }

  processReviewResult (card, multiplier) {
    card.recall = Math.max(1, card.recall * multiplier);
    card.success = multiplier;
    card.nextReviewDate = Date.now() + card.recall * 24 * 3600 * 1000;
    card.state = this.getCardState(card);
    console.log(card);

    this.history.logCardRecall(card, Math.floor(multiplier));
  }

  getCardState (card) {
    if (card.recall === 0) return 'NEW';

    if (card.recall >= 10000) return 'ARCHIVED';

    switch (card.success) {
      case 0: return 'FAIL';
      case 1: return 'GOOD';    // Will update later for HARD, must give users time to use the new logging first
      case 2: return 'GOOD';
      default: return 'FAIL';   // TODO: Rethink
    }
  }

}

function padArray(arr: any[], len) {
  if (arr.length >= len) return arr;
  else return arr.concat(Array(len - arr.length));
}

/* EXPORT */

export default JS;
