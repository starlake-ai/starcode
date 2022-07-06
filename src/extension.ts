// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { loadConfig, ISettings } from './settings';
import {parse as parseYaml} from 'yaml';
import { loadEnv } from './env'
import { globals } from './globals'
import { runValidate } from './run/validate'
import { runLoad } from './run/load'
import { runJob } from './run/job'
import { previewJobQuery } from './run/previewjob'
import { runYml2gv } from './run/yml2gv'
import { runYml2xls } from './run/yml2xls'
import { runXls2yml } from './run/xls2yml'
import { runQuery } from './run/query'
import { runDry } from './run/dry'

type CommandMap = Map<string, (uri:vscode.Uri) => void>;
let commands: CommandMap = new Map<string, (uri:vscode.Uri) => void>([
  ["starlake.validate", runValidate],
  ["starlake.load", runLoad],
  ["starlake.previewJobQuery", previewJobQuery],
  ["starlake.runjob", runJob],
  ["starlake.runQuery", runQuery],
  ["starlake.yml2gv", runYml2gv],
  ["starlake.yml2xls", runYml2xls],
  ["starlake.xls2yml", runXls2yml]
]);



function createSwitchEnvItem(context: vscode.ExtensionContext)
{
    globals.switchEnvItem.command = 'starlake.switchEnv';
    context.subscriptions.push(vscode.commands.registerCommand('starlake.switchEnv', async () => 
    {
		let envs = listEnvs()
        globals.currentEnv = await vscode.window.showQuickPick(
            envs,
            { placeHolder: 'Select Env' }) || 'None';
			globals.switchEnvItem.text = `Env(${globals.currentEnv})`
			globals.extensionContext.workspaceState.update('cometEnv', globals.currentEnv);
    }));
	
	globals.currentEnv = globals.extensionContext.workspaceState.get('cometEnv') || 'None'
    globals.switchEnvItem.text = `Starlake Env(${globals.currentEnv})`;
    globals.switchEnvItem.tooltip = `Starlake Env`;
    globals.switchEnvItem.show();
}
function createSelectedFormatItem(context: vscode.ExtensionContext)
{
    globals.selectedFormatItem.command = 'starlake.selectFormat';
    context.subscriptions.push(vscode.commands.registerCommand('starlake.selectFormat', async () => 
    {
        globals.selectedFormat = await vscode.window.showQuickPick(
            ['csv', 'json', 'table'],
            { placeHolder: 'Results Format' }) || 'table';
			globals.selectedFormatItem.text = `Format(${globals.selectedFormat})`

    }));
    context.subscriptions.push(globals.selectedFormatItem);
    globals.selectedFormatItem.text = `Format(table)`;
    globals.selectedFormatItem.tooltip = `Query Results Format`;
    globals.selectedFormatItem.show();
}

function createProjectItem(context: vscode.ExtensionContext)
{
    globals.projectItem.command = "starlake.setProjectCommand";
	globals.projectItem.text = "No GCP project selected yet"
	vscode.commands.registerCommand(
		'starlake.setProjectCommand',
		() => setProjectCommand()
	)
	globals.projectItem.tooltip = `GCP project`
	globals.projectItem.show();
}

function dryRunSubscribe(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(document => {
			if (document.languageId === "starlake") {
				runDry(document.uri);
			}
		}),
		vscode.window.onDidChangeActiveTextEditor(e => {
            if (e !== undefined && e.document.languageId === "starlake") {
                runDry(e.document.uri);
            }
        }),
		vscode.window.onDidChangeTextEditorSelection(e => {
            if (e !== undefined && e.textEditor.document.languageId === "starlake") {
                runDry(e.textEditor.document.uri);
            }
        }),
        vscode.workspace.onDidCloseTextDocument(document => {
            //dryRunItem.text = "No dry run yet"
        }),

	);	
}

function isStarlakeWorkspace() {
	if(vscode.workspace.workspaceFolders !== undefined) {
		let wf = vscode.workspace.workspaceFolders[0].uri.fsPath ;
		let metadataPath = path.join(wf, globals.config.metadataDir)
		return fs.existsSync(metadataPath)
	} 
	else {
		return false
	}
}

function listEnvs() {
	if(vscode.workspace.workspaceFolders !== undefined) {
		let wf = vscode.workspace.workspaceFolders[0].uri.fsPath ;
		let metadataPath = path.join(wf, globals.config.metadataDir)
		let envFiles = fs.readdirSync(metadataPath).filter(fn => fn !== 'env.comet.yml' && fn.endsWith('.comet.yml') && fn.startsWith('env.'));
		let result = envFiles.map(fn => fn.substring(4, fn.length - ".comet.yml".length))
		result.push('None')
		return result.sort()
	}
	else {
		return ['None']
	}
}


function setProjectCommand(): void {
    let options: vscode.InputBoxOptions = {
        ignoreFocusOut: false,
    }
    globals.resourceClient.getProjects()
        .then(p => p[0])
        .then(ps => ps.map(p => p.id))
        .then(ps => vscode.window.showQuickPick(<string[]>ps))
        .then(p => {
            if (typeof (p) !== 'undefined') {
                globals.setCurrentProjectId(p);
            }
        })
        .catch(error => vscode.window.showErrorMessage(error.message));
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    globals.extensionContext = context;
	globals.config = loadConfig("starlake");
	if (isStarlakeWorkspace()) {
		dryRunSubscribe(context);
		createSwitchEnvItem(context)
		createSelectedFormatItem(context)
		createProjectItem(context);
		globals.updateStatusBarItems();
		commands.forEach((action, name) => {
			context.subscriptions.push(vscode.commands.registerCommand(name, action));
		});
		context.subscriptions.push(
			vscode.workspace.onDidChangeConfiguration(event => {
			  if (!event.affectsConfiguration("starlake")) {
				return;
			  }
			  globals.config = loadConfig("starlake");
			}),
			vscode.commands.registerCommand(
				'starlake.dryRun',
				() => {
					const editor = vscode.window.activeTextEditor;
					if (editor !== undefined) {
						const document = editor.document;
						if (document.languageId === 'starlake') {
							runDry(document.uri);
						}
					}
				}
			)			
		  );
		  vscode.window.showInformationMessage("Starlake Workspace loaded")

	} else {
		// vscode.window.showErrorMessage("Invalid Workspace folder. Please make sure you open a valid starlake project")
	}
}

// this method is called when your extension is deactivated
export function deactivate() {}


/////////////////////////////////////////
/////////////////////////////////////////
/////////////////////////////////////////
/////////////////////////////////////////

function getEngine(jobPath: string): any {
	if (fs.existsSync(jobPath)) {
		const content = fs.readFileSync(jobPath, 'utf8')
		let jobObject = parseYaml(content)
		if (jobObject.transform) {
			let engine = (jobObject.transform.engine as string).trim()
			if (engine.indexOf("}") > 0) {
				let engineVar = engine.replace("${", "").replace("{{", "").replace("}", "")
				let engineValue = loadEnv(globals.config.metadataDir, globals.currentEnv).get(engineVar)
				if (engineValue == 'undefined') 
					return 'None'
				else
					return engineValue
			}
		}
		else {
			vscode.window.showErrorMessage(`transform tag not found in job file ${jobPath}`);
		}
	}
	else {
		vscode.window.showErrorMessage(`Job file ${jobPath} not found`);
		return "None"
	}
}





