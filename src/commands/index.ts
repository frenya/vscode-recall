
/* IMPORT */

import * as _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
var edn = require('edn-data/stream');
var unzipper = require('unzipper');
import Config from '../config';
import Utils from '../utils';
import { open as openWebview } from '../views/webview';
import { pathNormalizer } from '../utils/embedded/providers/abstract';
import { decorationBadgeState } from '../decorators';

function startRecall () {
  return openWebview();
}

function startFileReview () {
  const doc = vscode.window.activeTextEditor && vscode.window.activeTextEditor.document;
  if (doc && doc.uri.fsPath) {
    return openWebview(pathNormalizer(doc.uri.fsPath));
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

  if (deckContent) openNewTextDocument(`# ${deck.name}\n\n${deckContent}`, 'markdown');
}

function generateMarkdownForCard (card) {
  // Replace horizontal rulers with empty line
  let content = card.content.replace('\n---\n', '\n\n');
  
  if (content.startsWith('#')) return content;
  else return `## ${content}`;
}

function openNewTextDocument (content, language) {
  vscode.workspace.openTextDocument({ content, language })
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

function configureExtraCss () {
  const config = Config(null);
  let extraCssArray = [];
  extraCssArray = config.get('extraCss');

  let quickPickOptions = [];
  vscode.extensions.all.forEach((e) => {
    if (e.packageJSON.contributes) {
      let previewStyles = e.packageJSON.contributes['markdown.previewStyles'] || [];
      if (previewStyles.length) {
        previewStyles.forEach(extraCss => {
          const label = path.join(e.id, extraCss);
          const localPath = path.join(`{{${e.id}}}`, extraCss);
          quickPickOptions.push({ label, localPath, picked: extraCssArray.indexOf(localPath) >= 0 })
        });
      }
    }
  });

  // Show quick pick with preselected items from the configuration
  vscode.window.showQuickPick(quickPickOptions, { canPickMany: true })
    .then(selectedOptions => {
      if (selectedOptions) config.update('extraCss', selectedOptions.map(x => x.localPath), vscode.ConfigurationTarget.Workspace);
    });
}

function cardStatistics () {
  const cardProvider = Utils.embedded.provider;

  cardProvider.getCards()
    .then(cards => {
      // Add the isDue flag whether card is due
      cards.forEach(card => card.isDue = cardProvider.isCardDue(card) ? 'Due' : 'Future');

      // Group the cards by file, status and the isDue flag
      let result = countBy(cards, ['relativePath', card => decorationBadgeState(card) || 'REVERSE', 'isDue']);

      // Show JSON with results in a new document
      // NOTE: The replace method is just to compact the last level of nesting
      openNewTextDocument(JSON.stringify( result, null, 2).replace(/\n    (  |(\}))/g, ' $2'), 'json');
    });

  // NOTE: Inspired by https://gist.github.com/joyrexus/9837596 - genius
  function countBy(seq, keys) {
    if (!keys.length) return seq.length;
    let [ first, ...rest ] = keys;
    // Group by first key and then run the values through the countBy function recursively
    let result = _.mapValues(_.groupBy(seq, first), value => countBy(value, rest));
    return { 'Total cards': seq.length, 'Total due': seq.filter(cardProvider.isCardDue).length, ...result }
  };
}

/* EXPORT */

export {
  createCommandUrl, startRecall, startFileReview, convertMochiJSON, convertMochiExport, editFile,
  findChecksums, archiveCard, logCardToConsole, openSettings, configureExtraCss, cardStatistics
};
