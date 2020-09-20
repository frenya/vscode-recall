var moment = require('moment');
import { CompletionItemProvider, TextDocument, Position, CancellationToken, CompletionItem, CompletionContext, ProviderResult, CompletionList, workspace, CompletionItemKind, Range, TextEdit } from "vscode";

export class DateCompletionItemProvider implements CompletionItemProvider {
  public provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): ProviderResult<CompletionItem[] | CompletionList> {
        const items: CompletionItem[] = [];
        
        // First check that double slash was entered
        if (position.character < 2) return items;
        const range = new Range(position.translate(0, -2), position);
        const str = document.getText(range);
        if (str !== '//') return items;

        const displayFormat = {
            sameDay: '[Today]', 
            nextDay: '[Tomorrow]', 
            nextWeek: 'dddd', 
            sameElse: 'dddd, MMM DD'
        };

        let d = moment();
        for(let i = 0; i < 21; i++) {
            let ci = new CompletionItem(d.calendar(null, displayFormat), CompletionItemKind.Constant);
            // ci.label = d.toISOString().substr(0, 10);
            ci.detail = d.toISOString().substr(0, 10);
            ci.filterText = '//' + ci.label + ci.detail;     // Since we are replacing the trigger character, it must be included in the filter text
            ci.insertText = ci.detail;
            ci.sortText = ci.detail;
            ci.range = range;
            items.push(ci);
            d.add(1, 'day');
        }
            
        // console.log(items);
    return items;
  }
}
