import { CompletionItemProvider, TextDocument, Position, CancellationToken, CompletionItem, CompletionContext, ProviderResult, CompletionList, workspace, CompletionItemKind } from "vscode";
import Config from './config';

export class HashTagsCompletionItemProvider implements CompletionItemProvider {
  public provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): ProviderResult<CompletionItem[] | CompletionList> {
    const configuration = Config(document.uri).get<object>('mentions');

    if (!configuration) {
      return;
    }

    const items: CompletionItem[] = [];

    for (let tag of Object.keys(configuration)) {
      if (tag !== '<unassigned>') {
        items.push(new CompletionItem(tag, CompletionItemKind.Keyword));
      }
    }

    return items;
  }
}
