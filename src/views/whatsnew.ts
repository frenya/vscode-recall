import * as _ from 'lodash';
import * as path from 'path';
import * as vscode from 'vscode';
import stringMatches from 'string-matches';
import Consts from '../consts';
import File from '../utils/file';
import Folder from '../utils/folder';
import Utils from '../utils';
import { last } from 'lodash';
const semver = require('semver');

const VersionKey = 'recall.versionWatermark';

export async function open () {

  const lastVersion = Utils.getContextValue(VersionKey) || 'v0.0.0';

  // Parse Changelog and see if there are any new changes
  // TODO: Get lastVersion from context
  const changes = await parseChangelog(lastVersion);
  if (!changes.length) return;

  // Create and show panel
  const panel = vscode.window.createWebviewPanel(
    'Recall: What\'s new',
    'Recall: What\'s new',
    vscode.ViewColumn.One,
    {
      // Enable scripts in the webview
      // enableScripts: true
    }
  );

  const onDiskPath = vscode.Uri.file(path.join(Utils.context.extensionPath, 'resources', 'css', 'vs.css'));
  const styleSrc = panel.webview.asWebviewUri(onDiskPath);

  const pageMarkdown = [
    '# Recall: What\'s new',
    '',
    ... changes,
    '# Support',
    '',
    '- File bugs, feature requests in [GitHub Issues](https://github.com/frenya/vscode-recall/issues)',
    '- Leave a review on [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=frenya.vscode-recall)',
    '- Check out my [other extensions](https://marketplace.visualstudio.com/publishers/frenya)',
    '- If you like this extension and want to support it\'s further development, you can [Buy Me a Coffee](https://www.buymeacoffee.com/frenya)',
  ].join('\n');
  console.log(pageMarkdown);

  // Show loading message
  panel.webview.html = await getWebviewContent(styleSrc, pageMarkdown);

}

async function getWebviewContent(styleSrc, pageMarkdown) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" type="text/css" href="${styleSrc}">
    <title>Recall: What's new</title>
</head>
<body>
  <div class="container">
    ${await vscode.commands.executeCommand('markdown.api.render', pageMarkdown)}
  </div>
</body>
</html>`;
}

async function parseChangelog (lastVersion): Promise<String[]> {

  let data = [];

  // Get Markdown content
  const filePath = path.join(Utils.context.extensionPath, 'CHANGELOG.md');
  let content = await File.read(filePath);
  if (!content) return data;

  const versionRegex = Consts.regexes.version;
  
  // Find the card starts in the current file
  const matches = stringMatches ( content, versionRegex );

  // console.log(matches);
  if ( !matches.length ) return data;

  let versionWatermark = lastVersion;

  matches.forEach ( (match, i) => {
    // console.log('Version', match[1], 'is greater than', lastVersion, semver.gt(match[1], lastVersion));

    // Compare match with last version, only show the ones not seen yet
    if (semver.gt(match[1], lastVersion)) {
      // console.log('Parsing match', match, match.index, content.length)
      let nextCardStart = i + 1 < matches.length ? matches[i + 1].index : content.length;
      let cardText = _.trim(content.substring(match.index, nextCardStart));
      if (cardText) data.push(cardText);
    }

    // Increase watermark if applicable
    if (semver.gt(match[1], versionWatermark)) versionWatermark = match[1];

  });

  console.log(data);

  // Store watermark
  Utils.setContextValue(VersionKey, versionWatermark);

  return data;

}

/* EXPORT */

export default open;

