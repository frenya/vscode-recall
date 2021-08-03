
/* IMPORT */

import * as _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
var edn = require('edn-data/stream');
var unzipper = require('unzipper');
import Utils from '../utils';
import { open as openWebview } from '../views/webview';

function startRecall () {
  return openWebview();
}

function startFileReview () {
  const doc = vscode.window.activeTextEditor && vscode.window.activeTextEditor.document;
  if (doc && doc.uri.fsPath) {
    return openWebview(doc.uri.fsPath);
  }
  else {
    vscode.window.showWarningMessage('No document is currently active!');
  }
}

async function convertMochiExport () {
  const options = {
    filters: {
      'Mochi Archives': [ 'mochi' ]
    },
    title: 'Select Mochi export file'
  };
  
  const archiveUri:vscode.Uri[] = await vscode.window.showOpenDialog(options);
  if (!archiveUri || !archiveUri.length) {
    console.warn('No file selected');
    return;
  }

  try {
    fs.createReadStream(archiveUri[0].fsPath)
      .pipe(unzipper.Parse())
      .on('entry', function (entry) {
        if (entry.path === 'data.edn') {
          console.log('Parsing EDN file');
          entry.pipe(edn.parseEDNListStream({ mapAs: 'object', keywordAs: 'string' }))
            .on('data', function (data) {
              console.log(data);
              if (data.decks) data.decks.forEach(processDeck);
            });
        }
      });
  }
  catch (e) {
    console.error(e);
  }
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
  // Replace horizontal rulers with empty line
  let content = card.content.replace('\n---\n', '\n\n');
  
  if (content.startsWith('#')) return content;
  else return `## ${content}`;
}

function openNewMarkdownDocument (content) {
  vscode.workspace.openTextDocument({ content, language: 'markdown' })
    .then((doc: vscode.TextDocument) => vscode.window.showTextDocument(doc, 1, false));
}

function editFile (filePath, offset) {
  // console.log(filePath, offset);
  Utils.file.openTextFileAtOffset(filePath, offset);
}

function findChecksums (...args) {
  // console.log(filePath, offset);
  // Utils.file.openTextFileAtOffset(filePath, offset);
  vscode.commands.executeCommand('workbench.action.findInFiles', { 
    query: args.join('|'),
    triggerSearch: true,
    filesToInclude: '**/*.csv',
    isRegex: true,
    isCaseSensitive: false,
    matchWholeWord: false,
  });
}

function archiveCard (filePath, checksum) {
  Utils.embedded.provider.archiveCard(filePath, checksum);
}

function logCardToConsole (filePath, checksum) {
  Utils.embedded.provider.logCardToConsole(filePath, checksum);
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

function openSettings () {
  vscode.commands.executeCommand('workbench.action.openSettings', 'recall.' );
  vscode.commands.executeCommand('workbench.action.openWorkspaceSettings');
}


/* EXPORT */

export {
  createCommandUrl, startRecall, startFileReview, convertMochiJSON, convertMochiExport, editFile,
  findChecksums, archiveCard, logCardToConsole, openSettings
};
