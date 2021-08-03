
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

export const ARCHIVE_RECALL = 10000;

export const RESULT_FAIL = 0;
export const RESULT_STRUGGLE = 1;
export const RESULT_SUCCESS = 2;
export const RESULT_ARCHIVE = 3;

const resultMultipliers = [0, 0.5, 2];

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
    let recall = result.metadata.recall || config.get('defaultLevel') || 'header';
    const revertCards = _.endsWith(recall, '+');
    if (revertCards) recall = _.trimEnd(recall, '+');
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
        // Remove page breaks within code blocks
        coalesceCodeBlocks(cardPages);

        // Update the header stack
        // Remove all irrelevant headers
        headerStack.splice(cardType.length);
      }

      // Filter out empty pages
      cardPages = cardPages.filter(text => !!_.trim(text));

      let card = null;
      // Only push the cards that do have two or more pages
      if (cardPages.length > 1) {
        card = createCard(cardPages);
        fileData.data.push(card);
      }

      // Store header on stack
      if (isHeader) {
        headerStack = padArray(headerStack, cardType.length);
        headerStack.push(cardPages[0].replace(cardRegex, ''));
        // console.log('Header stack:', headerStack);
      }
      else {
        if (card && revertCards) {
          // Create reverse card
          const [ firstPage, secondPage, ...rest ] = cardPages;
          // let reverse = createCard([secondPage, firstPage, ...rest]);
          let reverse = createCard([`# ${secondPage}`, firstPage.replace(cardRegex, ''), ...rest]);
          reverse['reverseFor'] = card;
          card['reverseFor'] = reverse;
          reverse.reverse = true;
          fileData.data.push(reverse);

          // Make sure new reversed cards are always shown after NEW cards
          reverse.nextReviewDate += 1000;
        }
      }

      function createCard(cardPages) {
        return {
          pages: cardPages,
          offset: contentOffset + match.index,
          endOffset: contentOffset + nextCardStart,
          cardType: cardType,
          headerPath: _.compact(headerStack),
          checksums: [
            md5(cardPages.join('\n')), 
            md5(cardPages.map(x => x.replace(cardRegex, '')).join('\n'))
          ],
          // checksum: md5(cardPages.join('\n')),
          // checksumPure: md5(cardPages.map(x => x.replace(cardRegex, '')).join('\n')),
          nextReviewDate: Math.random() * 1000,   // To randomize the review of new cards as well
          recall: 0,
          reverse: false,
        };
      }

    });

    // console.log(fileData);
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
      const { data, ...fileMetadata } = fileData;
      Object.assign(card, fileMetadata);
      this.history.getCardRecall(card)
        .then(() => { card.state = this.getCardState(card); });
      return card;
    });
  }

  processReviewResult (card, result: number) {
    if (result < resultMultipliers.length) {
      const multiplier = resultMultipliers[result];
      card.recall = Math.max(1, card.recall * multiplier);
    }
    card.success = result;
    card.nextReviewDate = this.history.timestampToday() + card.recall * 24 * 3600 * 1000;
    card.state = this.getCardState(card);
    console.log(card);

    this.history.logCardRecall(card);
  }

  daisychainCard (card, originalCard) {
    // Sanity check
    if (!card || !originalCard) return;

    card.recall = originalCard.recall;
    card.success = originalCard.success;
    card.lastReviewDate = originalCard.lastReviewDate;
    card.nextReviewDate = originalCard.nextReviewDate;
    card.state = originalCard.state;
    console.log(card);

    this.history.logCardRecall(card, originalCard.lastReviewDate, originalCard.checksums[0]);
  }

  async archiveCard (filePath, checksum) {
    // Find the card
    const fileData = await this.getFileData(filePath);
    const cards = await this.getCardsFromFileData(fileData);
    let card = _.find(cards, c => c.checksums[0] === checksum);
    if (card) {
      card.recall = ARCHIVE_RECALL;
      this.processReviewResult(card, RESULT_ARCHIVE);
      this.refresh();
    }
    else console.warn('Card not found', filePath, checksum, fileData);
  }

  async logCardToConsole (filePath, checksum) {
    // Find the card
    const fileData = await this.getFileData(filePath);
    const cards = await this.getCardsFromFileData(fileData);
    let card = _.find(cards, c => c.checksums[0] === checksum);
    if (card) console.log(card);
    else console.warn('Card not found', filePath, checksum, fileData);
  }

  getCardState (card) {
    if (card.recall === 0) return 'NEW';

    if (card.recall >= ARCHIVE_RECALL) return 'ARCHIVED';

    switch (card.success) {
      case RESULT_FAIL: return 'FAIL';
      case RESULT_STRUGGLE: return 'HARD';
      case RESULT_SUCCESS: return 'GOOD';
      default: return 'ARCHIVED';   // TODO: Rethink
    }
  }

}

function padArray(arr: any[], len) {
  if (arr.length >= len) return arr;
  else return arr.concat(Array(len - arr.length));
}

function coalesceCodeBlocks (cardPages: string[]) {
  // Find opening and closing block pages
  let codeBlockRanges = []; // [[startIndex, endIndex, length], ...]
  let startIndex = -1;
  cardPages.forEach((pageText, i) => {
    if (isCodeBlockBoundary(pageText)) {
      if (startIndex >= 0) {
        codeBlockRanges.push([ startIndex, i + 1, i - startIndex + 1 ]);
        startIndex = -1;
      }
      else startIndex = i;
    }
  });

  // Coalesce the pages into one
  while (codeBlockRanges.length) {
    const range = codeBlockRanges.pop();
    cardPages.splice(range[0], range[2], cardPages.slice(range[0], range[1]).join('\n\n'));
  }
}

function isCodeBlockBoundary (text: string) {
  const codeBlockRegex = /^```/gm;

  return stringMatches(text, codeBlockRegex).length % 2;
}

/* EXPORT */

export default JS;
