
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

  // And set its HTML content
  panel.webview.html = await getWebviewContent(styleSrc);

  // Handle messages from the webview
  panel.webview.onDidReceiveMessage(
    message => {
      console.log(message);
      getWebviewContent(styleSrc).then(html => panel.webview.html = html);
      /*
      switch (message.command) {
        case 'alert':
          vscode.window.showErrorMessage(message.text);
          return;
      }
      */
    },
    undefined,
    Utils.context.subscriptions
  );

  // console.log(onDiskPath, panel.webview.html);
}


async function getWebviewContent(styleSrc) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" type="text/css" href="${styleSrc}">
    <title>Cat Coding</title>
</head>
<body>
    ${await renderCard(demoCard)}
    <script>
      (function() {
        const vscode = acquireVsCodeApi();
        addOnClickHandler('remember');
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

  return `<div class="card">
  <div class="preamble">
    <span>#123456789</span>
    <span>3/12</span>
  </div>
  ${renderedPages.join('\n')}
  <div class="buttons">
    <a id="remember" href="#" class="btn">Remembered</a>
    <a id="forgot"   href="#" class="btn">Forgot</a>
  </div>

</div>`;
}

/* EXPORT */

export {
  open
};
