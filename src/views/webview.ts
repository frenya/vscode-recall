
/* IMPORT */

import * as _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import Utils from '../utils';

const ARCHIVE_RECALL = 10000;

async function open () {
  // Create and show panel
  const panel = vscode.window.createWebviewPanel(
    'recallTest',
    'Recall - test session',
    vscode.ViewColumn.One,
    {
      // Only allow the webview to access resources in our extension's media directory
      //localResourceRoots: [vscode.Uri.file(path.join(Utils.context.extensionPath, 'src', 'views'))],
      // Enable scripts in the webview
      enableScripts: true
    }
  );

  const onDiskPath = vscode.Uri.file(path.join(Utils.context.extensionPath, 'src', 'views', 'card.css'));
  const styleSrc = panel.webview.asWebviewUri(onDiskPath);

  // Show loading message
  panel.webview.html = await getWebviewContent(styleSrc, 'Loading ...', null);

  await Utils.embedded.initProvider ();
  let cardProvider = Utils.embedded.provider;

  await cardProvider.get ( undefined, null );

  let currentCard = null, pagesShown = 1;

  function showNextCard() {
    currentCard = cardProvider.getNextCard();
    pagesShown = 1;
    rerender();
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
    getWebviewContent(styleSrc, 'No cards to review. Well done!', currentCard, pagesShown)
      .then(html => panel.webview.html = replaceRelativeMediaPaths(html, currentCard.rootPath))   // FIXME: Won't work for subdirs
      .catch(console.error);
  }

  function replaceRelativeMediaPaths (html, filePath) {

    // Replacer function - 
    function replacer (match, relPath, offset, str) {
      const onDiskPath = vscode.Uri.file(path.join(filePath, relPath));
      return `src="${panel.webview.asWebviewUri(onDiskPath)}"`;
    }
  
    return html.replace(/src="([^"]*)"/, replacer);
  
  }
  
  showNextCard();

  // Handle messages from the webview
  panel.webview.onDidReceiveMessage(
    message => {
      if (message === 'next') {
        currentCard.nextReviewDate += 60 * 1000;
        showNextCard();
        return;
      }

      // console.log(message);
      if(pagesShown < currentCard.pages.length) {
        if (message === 'expand') expandCard();
      }
      else {
        if (message === 'archive') toggleArchiveCard();
        else {
          // Don't archive when "forgot" is sent
          if (message === 'forgot') {
            if(currentCard.recall > ARCHIVE_RECALL) currentCard.recall -= ARCHIVE_RECALL;
            cardProvider.processReviewResult(currentCard, false);
            showNextCard();
          }
          else if (message === 'remembered') {
            cardProvider.processReviewResult(currentCard, true);
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
      // TODO: Handle onDidDispose properly
    },
    null,
    Utils.context.subscriptions
  );

  // TODO: Only allow one instance to exist
  // see https://code.visualstudio.com/api/extension-guides/webview#visibility-and-moving


  // console.log(onDiskPath, panel.webview.html);
}

async function getWebviewContent(styleSrc, fallbackMessage, card, pagesShown = 1) {
  console.log('Showing card', card);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" type="text/css" href="${styleSrc}">
    <title>Recall - test session</title>
</head>
<body>
    <div class="container">
    ${card ? await renderCard(card, pagesShown) : fallbackMessage}
    </div>
    <script>
      (function() {
        const vscode = acquireVsCodeApi();
        addOnClickHandler('expand');
        addOnClickHandler('remembered');
        addOnClickHandler('forgot');

        function onButtonClick(id) {
          // console.log(id);
          vscode.postMessage(id);
        }

        function addOnClickHandler(id) {
          const btn = document.getElementById(id);
          console.log(btn);
          btn.onclick = function (e) { onButtonClick(id); };
        };

        document.body.onkeypress = function(e) { 
          if (e.code === 'Space') onButtonClick('expand');
          else if (e.code === 'Enter') onButtonClick('remembered');
          else if (e.code === 'KeyF' ) onButtonClick('forgot');
          else if (e.code === 'KeyA' ) onButtonClick('archive');
          else if (e.code === 'KeyN' ) onButtonClick('next');
          else console.log(e);
        };
      }());
    </script>
</body>
</html>`;
}

/* Card render */
async function renderPage(pageText) {
  return await vscode.commands.executeCommand ( 'markdown.api.render', pageText );
}

async function renderCard (card, pagesShown) {
  const renderedPages = await Promise.all(card.pages.map(async (text, i) => {
    return `<div class="${i ? 'back' : 'front'}" style="${i < pagesShown ? '' : 'display: none;'}">${await renderPage(text)}</div>`;
  }));

  return `<div class="preamble">
    <span><b>${card.root}</b> / ${card.relativePath}</span>
  </div>
  <div class="card">
    ${renderedPages.join('\n')}
    <div class="buttons" style="${pagesShown < card.pages.length ? '' : 'display: none;'}">
      <a id="expand" href="#" class="btn" onclick="console.log">Expand</a>
    </div>
    <div class="buttons" style="${pagesShown === card.pages.length ? '' : 'display: none;'}">
      <a id="remembered" href="#" class="btn">Remembered</a>
      <a id="forgot"   href="#" class="btn">Forgot</a>
    </div>
    <div class="buttons" style="${card.recall > ARCHIVE_RECALL ? '' : 'display: none;'}">
      <span class="warning">Press Enter to archive the card.</span>
    </div>
  </div>
  <div class="postscript">
    <span>Id: ${card.checksum}</span>
    <span>Recall: ${card.recall}</span>
  </div>`;
}

/* EXPORT */

export {
  open
};
