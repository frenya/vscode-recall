
/* IMPORT */

import * as _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import Utils from '../utils';
import { open as openWebview } from '../views/webview';

function startRecall () {
  return openWebview();
}

function convertMochiJSON () {
  try {
    let mochi = JSON.parse(vscode.window.activeTextEditor.document.getText());
    console.log(mochi);

    mochi.decks.forEach(processDeck);
  }
  catch (e) {
    console.error(e);
  }
}

function processDeck (deck) {
  let deckContent = _.trim(deck.cards.map(generateMarkdownForCard).join('\n\n'));

  if (deckContent) openNewMarkdownDocument(`# ${deck.name}\n\n${deckContent}`);
}

function generateMarkdownForCard (card) {
  return `## ${card.name}\n\n${card.content}`;
}

function openNewMarkdownDocument (content) {
  vscode.workspace.openTextDocument({ content, language: 'markdown' })
    .then((doc: vscode.TextDocument) => vscode.window.showTextDocument(doc, 1, false));
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
  createCommandUrl, startRecall, convertMochiJSON,
};
