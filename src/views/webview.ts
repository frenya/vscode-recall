
/* IMPORT */

import * as _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import Config from '../config';
import Utils from '../utils';
import { createCommandUrl } from '../commands';
import { decorationBadgePath } from '../decorators';

import { ARCHIVE_RECALL, RESULT_FAIL, RESULT_STRUGGLE, RESULT_SUCCESS } from '../utils/embedded/providers/js';

let extraCssArray = [];

async function open (filePath?: string) {

  // Only allow one instance to exist
  // see https://code.visualstudio.com/api/extension-guides/webview#visibility-and-moving
  if (Utils.panel) {
    // If, for any reason, the reveal doesn't work
    // just continue with creating new webview
    try {
      Utils.panel.reveal();
      return;
    }
    catch (e) {
      console.warn(e);
    }
  }

  // Get extra CSS style paths
  const config = Config(null);
  extraCssArray = config.get('extraCss') || [];

  extraCssArray = extraCssArray.map(extraCss => extraCss.replace(/\{\{(.*)\}\}/, (match, p1) => {
    return vscode.extensions.getExtension(p1).extensionPath;
  }));

  const extraCssRoots = extraCssArray.map(extraCss => vscode.Uri.file(path.dirname(extraCss)));

  const workspaceFolderUris = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.map(x => x.uri) : [];

  // Create and show panel
  const panel = vscode.window.createWebviewPanel(
    'recallTest',
    'Recall: Flashcards Test',
    vscode.ViewColumn.One,
    {
      // Allow the webview to access resources in ...
      localResourceRoots: [
        // ... our extension's media directory
        vscode.Uri.joinPath(Utils.context.extensionUri, 'resources'),
        // ... all the folders of the current workspace
        ...workspaceFolderUris,
        // ... all the other extensions providing CSS preview styles
        ...extraCssRoots
      ],
      // Enable scripts in the webview
      enableScripts: true,
      enableCommandUris: true,
    }
  );
  Utils.panel = panel;

  // Show loading message
  panel.webview.html = await getWebviewContent(panel, 'Loading ...', null);

  await Utils.embedded.initProvider ();
  let cardProvider = Utils.embedded.provider;

  // Status bar counters
  let currentCardIndex = 0, totalCards = 0;
  let statusBarMessage: vscode.Disposable = null;

  const filterFn = (fp) => (fp === filePath);
  let queue = [];

  let currentCard = null, pagesShown = 1;

  // Get new card limits from configuration
  let newCardCounter:number = config.get('newCardLimit') || Number.MAX_SAFE_INTEGER, skipNewCardCount = 0;

  // Ignore the limit when testing a single file
  if (filePath) newCardCounter = Number.MAX_SAFE_INTEGER;

  await loadData();

  function getNextCard () {
    const firstCard = _.minBy (_.filter(queue, cardProvider.isCardDue), 'nextReviewDate');
    return firstCard;
  }

  function showNextCard() {
    currentCard = getNextCard();
    pagesShown = 1;
    if (currentCard) currentCardIndex++;

    // Limit the number of new cards for review
    if (!currentCard || currentCard.recall || currentCard.reverse || (newCardCounter-- > 0)) {
      rerender();
    }
    else {
      skipNewCardCount++;
      skipCard();
    }
  }

  function skipCard () {
    // This isn't good - for many reasons
    // currentCard.nextReviewDate = Date.now() + 24 * 3600 * 1000;

    // Remove the card from queue
    _.pull(queue, currentCard);

    showNextCard();
  }

  function expandCard() {
    pagesShown++;
    rerender();
  }

  function toggleArchiveCard() {
    if (currentCard.recall > ARCHIVE_RECALL) currentCard.recall -= ARCHIVE_RECALL;
    else currentCard.recall += ARCHIVE_RECALL;
    rerender();
  }

  function rerender () {
    // Fallback message
    let fallbackMessage = [ '<p>No more cards to review. Well done!</p>' ];
    if (skipNewCardCount) fallbackMessage.push(`<p><i>(${skipNewCardCount} new cards were automatically skipped, run the review again to go over them)</i></p>`);

    // Show progress of the review
    // console.log('New cards left', newCardCounter, 'Showing card', currentCard);
    if (statusBarMessage) statusBarMessage.dispose();
    let newCardsMessage = newCardCounter < totalCards ? `, ${newCardCounter} new cards left` : '';
    if (newCardCounter < 0) newCardsMessage = skipNewCardCount ?  `, skipped ${skipNewCardCount} new cards` : '';
    statusBarMessage = vscode.window.setStatusBarMessage(`Reviewing card ${currentCardIndex} of ${totalCards}${newCardsMessage}`);

    getWebviewContent(panel, fallbackMessage.join('\n'), currentCard, pagesShown)
      .then(html => panel.webview.html = replaceRelativeMediaPaths(html))
      .catch(console.error);
  }

  function replaceRelativeMediaPaths (html) {

    const basePath = currentCard ? currentCard.rootPath : '';
    const subdirPath = currentCard ? currentCard.subdirPath : '';

    // Replacer function - 
    function replacer (match, relPath, offset, str) {
      // Don't do anything with actual url's
      if (relPath.match(/^([a-z]+:\/\/)/)) return match;

      // Create webpanel url for local files
      const onDiskPath = path.isAbsolute(relPath) ? relPath : path.join(basePath, subdirPath, relPath);
      return `src="${panel.webview.asWebviewUri(vscode.Uri.file(onDiskPath))}"`;
    }
  
    return html.replace(/src="([^"]*)"/g, replacer);
  
  }
  
  showNextCard();

  const refreshListener = Utils.embedded.provider.onFilesDataChanged(refresh);

  async function refresh () {
    console.warn('Refreshing webview ...');
    // To make sure we are counting new cards correctly
    // - reset the skip count (to avoid counting them multiple times)
    // - increment newCardCounter if current card is new
    skipNewCardCount = 0;
    if (currentCard && currentCard.state === 'NEW') newCardCounter++;

    // Show loading message
    panel.webview.html = await getWebviewContent(panel, 'Reloading ...', null);
  
    await loadData();
    showNextCard();
  }

  setWebviewFocused(true);
  panel.onDidChangeViewState(e => setWebviewFocused(e.webviewPanel.active));

  // Reload the card deck and reset related variables
  async function loadData () {
    const allCards = await cardProvider.getCards(filePath ? filterFn : null);
    queue = allCards.filter(cardProvider.isCardDue);

    // Status bar counters
    currentCardIndex = 0;
    // let newCardsCount = queue.filter(card => card.recall === 0).length;
    totalCards = queue.length /*- (newCardsCount - Math.min(newCardsCount, newCardCounter)) */;
  }

  // Handle messages from the webview
  panel.webview.onDidReceiveMessage(
    message => {
      Utils.reporter.sendEvent(message);
    
      if (message === 'next') {
        skipCard();
        return;
      }

      // The following piece of code became ugly AF over time
      // TODO: extract to separate function
      // TODO: create unit tests
      // TODO: rethink the logic and refactor

      // console.log(message);
      if(pagesShown < currentCard.pages.length) {
        if (message === 'expand') expandCard();
      }
      else {
        if (message === 'archive') toggleArchiveCard();
        else {
          // Don't archive when "forgot" is sent
          if (message === 'forgot') {
            if(currentCard.recall >= ARCHIVE_RECALL) currentCard.recall -= ARCHIVE_RECALL;
            cardProvider.processReviewResult(currentCard, RESULT_FAIL);
            showNextCard();
          }
          else if (message === 'struggled') {
            if(currentCard.recall >= ARCHIVE_RECALL) currentCard.recall -= ARCHIVE_RECALL;
            cardProvider.processReviewResult(currentCard, RESULT_STRUGGLE);
            showNextCard();
          }
          else if (message === 'remembered') {
            // This is an ugly hack to make sure the archived cards have recall of exactly ARCHIVE_RECALL
            if(currentCard.recall >= ARCHIVE_RECALL) currentCard.recall = ARCHIVE_RECALL / 2;
            cardProvider.processReviewResult(currentCard, RESULT_SUCCESS);
            showNextCard();
          }
        }
      }
    },
    undefined,
    Utils.context.subscriptions
  );

  panel.onDidDispose(
    () => {
      if (statusBarMessage) statusBarMessage.dispose();
      if (refreshListener) refreshListener.dispose();
      Utils.embedded.provider.history.closeWriteStreams();
      Utils.panel = null;
      setWebviewFocused(false);
    },
    null,
    Utils.context.subscriptions
  );

}

function setWebviewFocused(value: boolean) {
  vscode.commands.executeCommand('setContext', 'recall-focused', value);
}

function cssUrl (panel, fileName) {
  const onDiskPath = vscode.Uri.file(path.join(Utils.context.extensionPath, 'resources', 'css', fileName));
  return panel.webview.asWebviewUri(onDiskPath);
}

function extraCssLinks (panel, extraCssArray) {
  return extraCssArray.map(extraCss => `<link rel="stylesheet" type="text/css" href="${panel.webview.asWebviewUri(vscode.Uri.file(extraCss))}">`);
}

async function getWebviewContent(panel, fallbackMessage, card, pagesShown = 1) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${extraCssLinks(panel, extraCssArray).join('')}
    <link rel="stylesheet" type="text/css" href="${cssUrl(panel, 'card.css')}">
    <title>Recall: Flashcards Test</title>
</head>
<body class="vscode-body">
    <div class="container markdown-body" dir="auto">
    ${card ? await renderCard(card, pagesShown) : fallbackMessage}
    </div>
    <script>
      (function() {
        const vscode = acquireVsCodeApi();
        addOnClickHandler('expand');
        addOnClickHandler('remembered');
        addOnClickHandler('struggled');
        addOnClickHandler('forgot');
        addOnClickHandler('next');

        function onButtonClick(id) {
          // console.log(id);
          vscode.postMessage(id);
        }

        function addOnClickHandler(id) {
          const btn = document.getElementById(id);
          // console.log(btn);
          btn.onclick = function (e) { onButtonClick(id); };
        };

        document.body.onkeypress = function(e) { 
          if (e.code === 'Space') onButtonClick('expand');
          else if (e.code === 'Enter') onButtonClick('remembered');
          else if (e.code === 'KeyF' ) onButtonClick('forgot');
          else if (e.code === 'KeyA' ) onButtonClick('archive');
          else if (e.code === 'KeyN' ) onButtonClick('next');
          else if (e.code === 'KeyS' ) onButtonClick('struggled');
          else console.log(e);
        };
        window.focus();
      }());
    </script>
</body>
</html>`;
}

/* Card render */
async function renderPage(pageText) {
  return await vscode.commands.executeCommand ( 'markdown.api.render', pageText );
}

function renderRecallStars(value) {
  if (value <= 0) return '';
  const stars = Math.min(Math.log2(value), 5);
  const text = ' ★'.repeat(stars).padStart(10, ' ☆');
  return `<span style="color: rgba(221, 187, 17, ${0.5 + stars / 10.0});">${text}</span>`;
}

async function renderCard (card, pagesShown) {
  const renderedPages = await Promise.all(card.pages.map(async (text, i) => {
    return `<div class="${i ? 'back' : 'front'}" style="${i < pagesShown ? '' : 'display: none;'}">${await renderPage(text)}</div>`;
  }));

  const headerDivider = ' \u25B6 ';

  return `<div class="preamble">
    <span><img class="label" src="${decorationBadgePath(card, 13)}" alt="${card.state}"></img> <b>${card.root}</b> / ${card.relativePath}${card.headerPath.length ? headerDivider : ''}${card.headerPath.join(headerDivider)}</span>
    <span>${renderRecallStars(card.recall)}</span>
  </div>
  <div class="card">
    ${renderedPages.join('\n')}
    <div class="buttons" style="${pagesShown < card.pages.length ? '' : 'display: none;'}">
      <a id="expand" href="#" class="btn" onclick="console.log">Expand (Space)</a>
      <a id="next" href="#" class="btn" onclick="console.log">Next (N)</a>
    </div>
    <div class="buttons" style="${pagesShown === card.pages.length ? '' : 'display: none;'}">
      <a id="remembered" href="#" class="btn">Remembered (Enter)</a>
      <a id="struggled" href="#" class="btn">Struggled (S)</a>
      <a id="forgot"   href="#" class="btn">Forgot (F)</a>
    </div>
    <div class="buttons" style="${card.recall >= ARCHIVE_RECALL ? '' : 'display: none;'}">
      <span class="warning">Press Enter to archive the card.</span>
    </div>
  </div>
  <div class="postscript">
    <span>Id: ${card.checksums[0]}</span>
    <span>Recall: ${card.recall}</span>
    <span><a href="${createCommandUrl('editFile', card.filePath, card.offset)}">Edit</a></span>
  </div>`;
}

/* EXPORT */

export {
  open
};
