import * as vscode from 'vscode';
import * as _ from 'lodash';
import * as path from 'path';
import Config from './config';
import Consts from './consts';
import { createCommandUrl } from './commands';
import Editor from './editor';
import Utils from './utils';

const badgeColors = {
  ARCHIVED: 'black',
  GOOD: 'green',
  HARD: 'orange',
  FAIL: 'red',
  NEW: 'blue',
  UPDATED: 'yellow',
  DUPLICATE: 'red',
};

export const badgeUrl = (state, scale) => `https://badgen.net/badge/card/${state}/${badgeColors[state]}?scale=${scale}`;
export const badgeUrlFile = (state, size) => path.join(Utils.context.extensionPath, 'resources', 'icons', `badge_${state}_${size}.svg`);
const standardBadgeSize = 20.0;

const Decorators = {

  timeout: undefined,

  decorators: {},

  sources: {},

  activeEditor: undefined,

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
        (hiddenBadges.indexOf(state) < 0) ? { after: Object.assign({ contentIconPath: vscode.Uri.parse(badgeUrlFile(state, 13)), margin: `0 0 0 ${lineHeight}px` }) } : {});
    });

    this.setEditor(vscode.window.activeTextEditor);
    vscode.window.onDidChangeActiveTextEditor(editor => this.setEditor(editor), null, context.subscriptions);
  
    vscode.workspace.onDidChangeTextDocument(event => {
      if (this.activeEditor && event.document === this.activeEditor.document) {
        this.triggerUpdateDecorations();
      }
    }, null, context.subscriptions);
    
    vscode.workspace.onDidChangeConfiguration(() => {
      this.triggerUpdateDecorations();
    }, null, context.subscriptions);

    // TODO: Push disposables to context.subscriptions
  },
  
  setEditor (editor: vscode.TextEditor) {
    this.activeEditor = editor;
    if (editor) {
      this.sources = {};
      this.triggerUpdateDecorations();
    }
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
    const fileData = Utils.embedded.provider.parseContent(doc.getText(), Utils.embedded.provider.emptyFileData(doc.uri.fsPath));

    const cards = await Utils.embedded.provider.getCardsFromFileData(fileData);
    cards.forEach (item => {
      // Decorate item badges
      // console.log('Decorating item', item);
      this.decorators[item.state].ranges.push({
        range: doc.lineAt(doc.positionAt(item.offset)).range,
      });
    });

    console.log('Applying decorators', this.decorators);
    Object.keys(this.decorators).forEach(group => {
      const d = this.decorators[group];
      this.activeEditor.setDecorations(d.type, d.ranges);
    });
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

};

export default Decorators;