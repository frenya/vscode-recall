import * as assert from 'assert';
import { before, after } from 'mocha';
import * as sinon from 'sinon';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as path from 'path';

import Config from '../../config';
import { isItMyself, mySyncSettings, getFullname } from '../../commands/mentions';

const uri = vscode.Uri.file(path.resolve(__dirname, '../../../demo/New Datacenter/Kick-off.md'));

suite('Demo workspace configuration', () => {

  let config = null;
	before(() => {
    config = Config(null);
	});

  test('should have owners e-mails', () => {
    assert.deepEqual(config.get('emails'), [ 
      'frenya@frenya.net' 
    ]);
  });

  test('should have initial mentions', () => {
    assert.deepEqual(config.get('mentions'), defaultWorkspaceMentions);
  });

  test('should identify myself', () => {
    assert(isItMyself(config, 'Frenya'));
    assert(!isItMyself(config, 'Frank'));
  });

  test('should get sync settings', () => {
    assert.deepEqual(mySyncSettings(config, 'Frenya'), {});
    assert.deepEqual(mySyncSettings(config, 'Frank'), null);
  });

});

suite('Demo folder configuration', () => {

  let config = null;
	before(() => {
    config = Config(uri);
	});

  // TODO: Add demo data to test merging and override
  test('should have initial mentions', () => {
    assert.deepEqual(config.get('mentions'), {
      ...defaultFolderMentions,
      ...defaultWorkspaceMentions
    });
  });

  test('should identify myself', () => {
    assert(isItMyself(config, 'Frenya'));
    assert(isItMyself(config, 'Frank'));
    assert(!isItMyself(config, 'Anne'));
  });

  test('should get sync settings', () => {
    assert.deepEqual(mySyncSettings(config, 'Frenya'), {});
    assert.deepEqual(mySyncSettings(config, 'Frank'), {});
    assert.deepEqual(mySyncSettings(config, 'Anne'), null);
  });

});


suite('Adding mentions', () => {

  let config = null;
  let folderConfig = null;
  let showInputBoxStub = null;

	before(() => {
    config = Config(null);
    folderConfig = Config(uri);

    // Stub the showInputBox method
    showInputBoxStub = sinon.stub(vscode.window, 'showInputBox');
    showInputBoxStub.onFirstCall().resolves(null);
    showInputBoxStub.onSecondCall().resolves('Test');
    showInputBoxStub.resolves('Sheldon Cooper');
  });
  
  after(() => {
    // Reset mentions back to default
    Config(null).update('mentions', defaultWorkspaceMentions);
    Config(uri).update('mentions', defaultFolderMentions);
  });

  test('should add empty mention to folder', async () => {
    // First call simulates user pressing Esc (showInputBoxStub returns null)
    await vscode.commands.executeCommand('recall.createMention', null, uri.path);
    assert.deepEqual(Config(uri).get('mentions'), {
      ...defaultFolderMentions,
      ...defaultWorkspaceMentions
    });

    // Second call simulates user entering a name (showInputBoxStub returns "Test")
    await vscode.commands.executeCommand('recall.createMention', null, uri.path);
    assert.deepEqual(Config(uri).get('mentions'), {
      ...defaultFolderMentions,
      ...defaultWorkspaceMentions,
      'Test': {}
    });
  });
  
  test('should add mention to folder', async () => {
    await vscode.commands.executeCommand('recall.createMention', 'Sheldon', uri.path);
    assert.deepEqual(Config(uri).get('mentions'), {
      ...defaultFolderMentions,
      ...defaultWorkspaceMentions,
      'Test': {},
      'Sheldon': {}
    });
  });
  
  test('should ignore second addition of the same mention', async () => {
    await vscode.commands.executeCommand('recall.createMention', 'Sheldon', uri.path);
    assert.deepEqual(Config(uri).get('mentions'), {
      ...defaultFolderMentions,
      ...defaultWorkspaceMentions,
      'Test': {},
      'Sheldon': {}
    });
  });
  
  test('should add mention detail to folder', async () => {
    await vscode.commands.executeCommand('recall.addMentionDetail', 'Sheldon', 'fullname', uri.path);
    assert.deepEqual(Config(uri).get('mentions'), {
      ...defaultFolderMentions,
      ...defaultWorkspaceMentions,
      'Test': {},
      'Sheldon': {
        fullname: 'Sheldon Cooper'
      }
    });
  });
  
  test('should add mention to workspace', async () => {
    await vscode.commands.executeCommand('recall.createMention', 'WMention', '');
    assert.deepEqual(Config(null).get('mentions'), {
      ...defaultWorkspaceMentions,
      'WMention': {}
    });
  });
  
  test('should add mention detail to workspace', async () => {
    await vscode.commands.executeCommand('recall.addMentionDetail', 'WMention', 'fullname', '');
    assert.deepEqual(Config(null).get('mentions'), {
      ...defaultWorkspaceMentions,
      'WMention': {
        fullname: 'Sheldon Cooper'
      }
    });
  });
  
  test('should add mention detail to workspace', async () => {
    await vscode.commands.executeCommand('recall.addMentionDetail', 'WMention', 'fullname', '');
    assert.deepEqual(Config(null).get('mentions'), {
      ...defaultWorkspaceMentions,
      'WMention': {
        fullname: 'Sheldon Cooper'
      }
    });
  });
  
  test('should add mention detail to new mention in workspace', async () => {
    await vscode.commands.executeCommand('recall.addMentionDetail', 'Empty', 'fullname', '');
    assert.deepEqual(Config(null).get('mentions'), {
      ...defaultWorkspaceMentions,
      'WMention': {
        fullname: 'Sheldon Cooper'
      },
      'Empty': {
        fullname: 'Sheldon Cooper'
      }
    });
  });
  
});

suite('Full names', () => {

  test('should resolve workspace full name', async () => {
    assert.equal(getFullname('Frenya', null), 'Frantisek Vymazal');
    assert.equal(getFullname('Frank', null), 'Frank');
  });
  
  test('should resolve folder full name', async () => {
    assert.equal(getFullname('Frenya', uri), 'Frantisek Vymazal');
    assert.equal(getFullname('Frank', uri), 'Frantisek Vymazal');
    assert.equal(getFullname('Frantisek', uri), 'Frantisek');
  });
  
});

// Fixtures
const defaultWorkspaceMentions = {
  'Frenya': {
    'fullname': 'Frantisek Vymazal',
    'email': 'frenya@frenya.net'
  }
};

const defaultFolderMentions = {
  'John': {
    'fullname': 'John Adams',
    'department': 'Networking',
  },
  'Doug': {
    'fullname': 'Doug Brown',
    'department': 'IT Operations',
  },
  'Anne': {
    'fullname': 'Anne Crowley',
    'department': 'Finance',
  },
  'Sean': {
    'fullname': 'Sean Dermot',
    'department': 'UPS Technologies',
  },
  'Steve': {
    'fullname': 'Steve Evans',
    'department': 'AC Plus',
  },
  'Rich': {
    'fullname': 'Richard Francis',
    'department': 'Project Manager',
  },
  'Frank': {
    'fullname': 'Frantisek Vymazal',
    'email': 'frenya@frenya.net'
  }, 
  '<unassigned>': {
    'email': '*'
  },
};