import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as path from 'path';
import Config from './config';
import Consts from './consts';
import { createCommandUrl } from './commands';
import Editor from './editor';
import Utils from './utils';
import { pathNormalizer } from './utils/embedded/providers/abstract';

const badgeColors = {
  ARCHIVED: 'black',
  GOOD: 'green',
  HARD: 'orange',
  FAIL: 'red',
  NEW: 'blue',
  UPDATED: 'yellow',
  DUPLICATE: 'red',
};

export const badgeUrl = (state, scale) => `https://badgen.net/badge/REVERSE/${state}/${badgeColors[state]}?scale=${scale}`;
export const badgeUrlFile = (state, size) => vscode.Uri.joinPath(Utils.context.extensionUri, 'resources', 'icons', `badge_${state}_${size}.svg`);
export const badgeUrlReverse = (state, size) => vscode.Uri.joinPath(Utils.context.extensionUri, 'resources', 'icons', `reverse_${state}_${size}.svg`);
const standardBadgeSize = 20.0;

const Decorators = {

  timeout: undefined,

  decorators: {},

  activeEditor: undefined,

  // Card change detection
  detectChanges: false,
  _cardCache: [],
  _editedCard: undefined,
  _bookends: [0, 0],

  init (context: vscode.ExtensionContext) {
    // Calculate proper badge scale based on editor font size
    // TODO: This should be updated when configuration changes
    const editorConfig = vscode.workspace.getConfiguration('editor', null);
    const lineHeight = editorConfig.fontSize + 1;
    const badgeScale = Math.min(lineHeight / standardBadgeSize, 1);
    // console.log('Badge scale', badgeScale.toFixed(2));

    // Initialize badge decorators
    // TODO: This should be updated when configuration changes
    const hiddenBadges: string[] = Config(null).get('hideBadges');
    Object.keys(badgeColors).forEach(state => {
      this.registerGroupDecorator(state,
        // { after: Object.assign({ contentIconPath: vscode.Uri.parse(badgeUrl(state, badgeScale.toFixed(2))), margin: `0 0 0 ${lineHeight}px` }) });
        (hiddenBadges.indexOf(state) < 0) ? { after: Object.assign({ contentIconPath: badgeUrlFile(state, 13), margin: `0 0 0 ${lineHeight}px` }) } : {});
      this.registerGroupDecorator(`ARCHIVED.${state}`,
        (hiddenBadges.indexOf(state) < 0) ? { after: Object.assign({ contentIconPath: badgeUrlReverse(state, 13), margin: `0 0 0 ${lineHeight}px` }) } : {});
      // console.log('Badge url for', `ARCHIVED.${state}`, vscode.Uri.parse(badgeUrl(state, 0.65)).toString());
    });

    this.setEditor(vscode.window.activeTextEditor);
    vscode.window.onDidChangeActiveTextEditor(editor => this.setEditor(editor), null, context.subscriptions);
  
    vscode.workspace.onDidChangeTextDocument(event => {
      if (this.activeEditor && event.document === this.activeEditor.document) {
        // Quick and dirty - only handle first change
        // console.log(event);
        if (event.contentChanges.length && this.detectChanges) {
          this.updateEditedCard(event.contentChanges[0]);
        }
        this.triggerUpdateDecorations();
      }
    }, null, context.subscriptions);
    
    vscode.workspace.onDidChangeConfiguration(() => {
      this.triggerUpdateDecorations();
    }, null, context.subscriptions);

    Utils.embedded.provider.onFilesDataChanged(() => {
      this.triggerUpdateDecorations();
    }, null, context.subscriptions);

    // TODO: Push disposables to context.subscriptions
  },
  
  setEditor (editor: vscode.TextEditor) {
    this.activeEditor = editor;
    this.detectChanges = false;
    this.resetEditedCard();
    if (editor) {
      this.triggerUpdateDecorations();
    }
  },

  resetEditedCard () {
    this._editedCard = undefined;
    this._bookends = [0, 0];
  },

  updateEditedCard (change) {
    // console.log('updateEditedCard', change);

    // Position of the edit
    const pos = change.rangeOffset;
    const len = change.rangeLength;

    // First check if change is within bookends
    const [min, max] = this._bookends;
    // console.log('Checking bookends', ...this._bookends);
    if (isBetween(pos, min, max) && isBetween(pos + len, min, max)) {
      // Just move the bookend and return
      this._bookends[1] += change.text.length - len;
      // console.log('Updating bookends', ...this._bookends);
      return;
    }

    // Find the card being edited
    // console.log('Looking for card at', pos, len);
    const card = _.find(this._cardCache, (card: any) => !card.reverse && isBetween(pos, card.offset, card.endOffset) && isBetween(pos + len, card.offset, card.endOffset));
    // console.log('Found', card);

    if (card) {
      console.log('Started editing card', card.offset, card.state, card.pages[0]);
      this._editedCard = card;
      this._bookends = [card.offset, card.endOffset];
      this._bookends[1] += change.text.length - len;  // Must move it here due to the edit
    }
    else {
      console.log('Couldn\'t match edit with card', change);
      this.resetEditedCard();
    }

    // Invalidate the cache because it cannot be trusted after an edit
    this._cardCache = [];
  },

  registerGroupDecorator (group: string, style: Object) {
    this.decorators[group] = {
      type: vscode.window.createTextEditorDecorationType(style),
      ranges: [],
    };
  },

  getMatchRange (match, group = 0) {
    const e = this.activeEditor;
    const start = e.document.positionAt(match.index);
    const end = e.document.positionAt(match.index + match[group].length);
    return new vscode.Range(start, end);
  },

  decorateMatches (regEx, callback) {
    const editor = this.activeEditor;
    const text = editor.document.getText();

    // Sanity check
    if (!callback) return;

    let match;
    while (match = regEx.exec(text)) {
      const range = this.getMatchRange(match);
      callback(match, range);
    }
  },

  async updateDecorations() {
    // Eligibility check
    if (!Editor.isSupported(this.activeEditor)) return;
    const doc = this.activeEditor.document;

    // Reset ranges
    Object.keys(this.decorators).forEach(key => this.decorators[key].ranges = []);

    // Parse the content using central parser
    // TODO: Use the invalidateFileContent method (will update fileData as a side-effect)
    const fileData = Utils.embedded.provider.parseContent(doc.getText(), Utils.embedded.provider.emptyFileData(pathNormalizer(doc.uri.fsPath)));

    const cards = await Utils.embedded.provider.getCardsFromFileData(fileData);
    cards.forEach (item => {
      let cardState = decorationBadgeState(item);
      if (this._editedCard && item.offset === this._bookends[0] && !item.reverse) {
        if (item.endOffset === this._bookends[1]) {
          // Only do this for non-new cards
          if (this._editedCard.state !== 'NEW' || (this._editedCard.reverseFor && this._editedCard.reverseFor.state !== 'NEW')) {
            cardState = 'UPDATED';

            // Save the original checksum so that we can daisychain
            const originalCard = this._editedCard;
            vscode.window.showInformationMessage(`Updated card "${this._editedCard.pages[0]}". Do you want to mark the change as minor and keep review history?`, 'Mark as minor')
              .then((action) => {
                if (action) {
                  console.log('Daisy chaining', item, originalCard);
                  Utils.embedded.provider.daisychainCard(item, originalCard);
                  Utils.embedded.provider.daisychainCard(item.reverseFor, originalCard.reverseFor);
                }
              });
          }
        }
        else {
          // Editing has probably created new card so we are no longer updating, reset bookends
          console.log('endOffset doesnt match', item.endOffset, ...this._bookends);
          this.resetEditedCard();
        }
      }
  
      if (cardState) {
        this.decorators[cardState].ranges.push({
          range: doc.lineAt(doc.positionAt(item.offset)).range,
          hoverMessage: this.getCardHoverMessage(item, item.state),
        });
      }
    });

    // console.log('Applying decorators', this.decorators);
    Object.keys(this.decorators).forEach(group => {
      const d = this.decorators[group];
      this.activeEditor.setDecorations(d.type, d.ranges);
    });

    this._cardCache = cards;
    this.detectChanges = true;
  },

  triggerUpdateDecorations() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
    this.timeout = setTimeout(() => {
      // The last thing I want is for the decorator to crash VSCode
      // so let's wrap it in try ... catch block just for safety
      try {
        this.updateDecorations()
          .catch(console.error);
      }
      catch (e) {
        console.error(e);
      }
    }, 1000);
  
  },

  getCardHoverMessage (item, cardState) {

    // Sanity check
    // if (!item || !item.recall) return;

    let result = [];
    
    result.push(`*recall*: ${item.recall}`);
    result.push(`*last*: ${formatDate(item.lastReviewDate)}, ${cardState}`);
    result.push(`*next*: ${formatDate(item.nextReviewDate)}`);
    result.push(`\n`);
    result.push(`[Show review history](${createCommandUrl('findChecksums', ...item.checksums)})`);
    // result.push(`[Log to console](${createCommandUrl('logCardToConsole', item.filePath, item.checksums[0])})`);
    result.push(`[Archive card](${createCommandUrl('archiveCard', item.filePath, item.checksums[0])})`);

    let contents = new vscode.MarkdownString(`**${item.reverse ? 'Reversed ' : ''}Card (${item.pages.length} pages)**\n\n${result.join('  \n')}`);

    // To enable command URIs in Markdown content, you must set the `isTrusted` flag.
    // When creating trusted Markdown string, make sure to properly sanitize all the
    // input content so that only expected command URIs can be executed
    contents.isTrusted = true;

    return contents;
  },



};

function formatDate (date) {
  try {
    // tslint:disable-next-line triple-equals
    const d = date == null ? new Date() : new Date(date);
    return d.toISOString().substr(0, 10);
  } 
  catch (e) {
    console.error('Error formatting date', date, e);
  }
  return '';
}

export function decorationBadgeState (item) {
  // NOTE: The conditions for state handling are a little bizzare, but basically
  // - non-reverse, archived cards that have a reverse card are ignored
  // - reverse, non-archived cards whose counterpart is archived show dual state
  // - every other card shows its state
  if (!item.reverseFor || ((item.state === 'ARCHIVED') === item.reverse)) {
    return item.state;
  }
  else if (item.reverse && item.reverseFor && (item.reverseFor.state === 'ARCHIVED')) {
    return `ARCHIVED.${item.state}`;
  }
}

export function decorationBadgePath (item, size) {
  // NOTE: The conditions for state handling are a little bizzare, but basically
  // - non-reverse, archived cards that have a reverse card are ignored
  // - reverse, non-archived cards whose counterpart is archived show dual state
  // - every other card shows its state
  // FIXME: Duplicate code with function above. Find a way to refactor.
  if (!item.reverseFor || ((item.state === 'ARCHIVED') === item.reverse)) {
    return badgeUrlFile(item.state, size).path;
  }
  else if (item.reverse && item.reverseFor && (item.reverseFor.state === 'ARCHIVED')) {
    return badgeUrlReverse(item.state, size).path;
  }
}

function isBetween (val, min, max) {
  return val >= min && val <= max;
}

export default Decorators;