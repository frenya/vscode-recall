import * as _ from 'lodash';
const fs = require('fs');
const path = require('path');
import { format, parse } from 'fast-csv';
import { Stream } from 'stream';

type RowType = {
  checksum: string,
  timestamp: number,
  success: boolean,
  recall: number,
};

class History {

  recallHistory: Object = {};

  constructor () {
    
  }

  destructor () {
    Object.getOwnPropertyNames(this.recallHistory).forEach(folderPath => {
      if (this.recallHistory[folderPath].stream) this.recallHistory[folderPath].stream.end();
    });
  }

  /**
   * Adds a folder to the mix, loads history, sets up the writer stream
   * 
   * @param folderPath Normalized absolute path to the workspace folder that should be added
   */
  async addFolder (folderPath: string) {
    if (!this.recallHistory[folderPath]) {
      console.log('Setting up recall history for folder', folderPath);
      const folderHistory = {
        // Object with card review history
        cards: Promise.resolve({}),

        // Writer stream
        stream: null
      };
      this.recallHistory[folderPath] = folderHistory;

      // Load the history
      // NOTE: the .cards attribute is actually a Promise that resolves to an object
      const logPath = path.join(folderPath, '.recall');
      folderHistory.cards = this.loadCardHistory(logPath);
    }
    return this.recallHistory[folderPath].cards;
  }

  /* async - essentially, returns Promise*/ 
  loadCardHistoryCSV (filePath) {
    // Get review date from filename
    const match = /recall-([0-9-]*)\.csv/.exec(filePath);
    const timestamp = match ? new Date(match[1]).valueOf() : 0;
    // console.log('Date from filename', filePath, new Date(timestamp));

    return new Promise<RowType[]>((resolve, reject) => {
      let result = [];
      try {
        fs.createReadStream(filePath)
          .pipe(parse({ headers: ['checksum', 'success', 'recall'] }))
          .transform(row => ({
            checksum: row.checksum,
            timestamp: timestamp,
            success: parseInt(row.success),
            recall: parseInt(row.recall),
          }))
          .on('error', reject)
          .on('data', row => { result.push(row); })
          .on('end', () => resolve(result));
      }
      catch (e) {
        console.error(e);
        reject(e);
      }
    });

  }

  async loadCardHistory (logPath) {
    // Sanity check
    if (!fs.existsSync(logPath)) return {};
    
    // Load all existing history files
    const globby = require('globby'); // Lazy import for performance
    const files = await globby('recall-*.csv', { cwd: logPath, absolute: true });

    const historyLog:RowType[] = _.flatten(await Promise.all(files.map(this.loadCardHistoryCSV)));

    return historyLog.reduce((result, row:RowType) => {
      const { checksum, ...review } = row;
      if (result[checksum]) result[checksum].push(review);
      else result[checksum] = [review];
      return result;
    }, {});
  }

  logCardRecall (card, multiplier) {
    const folderPath = card.rootPath;
    const folderHistory = this.recallHistory[folderPath];
    if (!folderHistory) {
      console.warn('Folder not initialized', folderPath);
      return;
    }

    // Lazy initialization of the log stream
    if (!folderHistory.stream) {
      // Make sure the log folder exists
      const logPath = path.join(folderPath, '.recall');
      fs.mkdirSync(logPath, { recursive: true });

      folderHistory.stream = fs.createWriteStream(
        path.join(logPath, `recall-${new Date().toISOString().substr(0, 10)}.csv`), 
        { flags: 'a' } // 'a' means appending (old data will be preserved)
      );
    }
    
    folderHistory.cards.then(cards => {
      // Update card history
      if (!cards[card.checksum]) cards[card.checksum] = [];
      cards[card.checksum].push({ timestamp: Date.now(), success: multiplier, recall: card.recall});

      const csvData = [card.checksum, multiplier, card.recall];
      console.log('Writing card to log', card, csvData);
  
      try {
        const result = folderHistory.stream.write(csvData.join(',') + '\n');
        // console.log('Write result', result);
      }
      catch (e) {
        console.error(e);
      }
    });
  }

  /**
   * 
   * @param card 
   * @param oldChecksum Optional "old" checksum - usefull when the logic of checksums changes
   */
  async getCardRecall (card) {
    const folderHistory = this.recallHistory[card.rootPath];
    if (!folderHistory) {
      console.warn('Folder not initialized', card.rootPath);
      return;
    }

    folderHistory.cards.then(cards => {
      const cardHistory = cards[card.checksum] || cards[card.checksumPure] || [];

      cardHistory.forEach(review => {
        const nextReviewDate = review.timestamp + review.recall * 24 * 3600 * 1000 + Math.random() * 1000;
        if (nextReviewDate > card.nextReviewDate) {
          card.nextReviewDate = nextReviewDate;
          card.recall = review.recall;
          card.success = review.success;
        }
      }, { nextReviewDate: 0 });
    });
  }
}

export default History;