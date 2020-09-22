
/* IMPORT */

import * as _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import Utils from '../utils';

async function open () {
  // Create and show panel
  const panel = vscode.window.createWebviewPanel(
    'catCoding',
    'Cat Coding',
    vscode.ViewColumn.One,
    {
      // Only allow the webview to access resources in our extension's media directory
      localResourceRoots: [vscode.Uri.file(path.join(Utils.context.extensionPath, 'src', 'views'))],
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
    getWebviewContent(styleSrc, 'No cards to review. Well done!', currentCard)
      .then(html => panel.webview.html = html)
      .catch(console.error);
  }

  showNextCard();

  // Handle messages from the webview
  panel.webview.onDidReceiveMessage(
    message => {
      console.log(message);
      cardProvider.processReviewResult(currentCard, message === 'remembered');
      showNextCard();
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
    <title>Cat Coding</title>
</head>
<body>
    <div class="container">
    ${card ? await renderCard(card) : fallbackMessage}
    </div>
    <script>
      (function() {
        const vscode = acquireVsCodeApi();
        addOnClickHandler('remembered');
        addOnClickHandler('forgot');

        function onButtonClick(id) {
          console.log(id);
          vscode.postMessage(id);
        }

        function addOnClickHandler(id) {
          const btn = document.getElementById(id);
          console.log(btn);
          btn.onclick = function (e) { onButtonClick(id); };
        };
      }());
    </script>
</body>
</html>`;
}

/* Card render */
const demoCard = {
  pages: [
   '# Memory card with text paragraphs',
   'This is the first paragraph.\nIt is separated from the rest by an empty line.',
   'This is the second paragraph.',
  ],
  root: 'New Datacenter',
  relativePath: 'Cards Demo.md',
};

async function renderPage(pageText) {
  return await vscode.commands.executeCommand ( 'markdown.api.render', pageText );
}

async function renderCard (card) {
  const renderedPages = await Promise.all(card.pages.map(async (text, i) => {
    const pageHTML = await renderPage(text);
    return `<div class="${i ? 'back' : 'front'}">${pageHTML}</div>`;
  }));

  return `<div class="preamble">
    <span>Id: ${card.checksum}</span>
    <span>Recall: ${card.recall}</span>
  </div>
  <div class="card">
  ${renderedPages.join('\n')}
  <div class="buttons">
    <a id="remembered" href="#" class="btn">Remembered</a>
    <a id="forgot"   href="#" class="btn">Forgot</a>
  </div>

</div>`;
}

/* EXPORT */

export {
  open
};