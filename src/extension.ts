// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as child_process from 'child_process';
import { loadConfig, ISettings } from './settings';
const { flatten } = require('safe-flat')
import { format } from 'sql-formatter';

import { BigQuery } from '@google-cloud/bigquery';
import { stringify } from 'csv-stringify';
import easyTable = require("easy-table");
import { Resource } from '@google-cloud/resource';
import {parse as parseYaml} from 'yaml';

type CommandMap = Map<string, (uri:vscode.Uri) => void>;
let commands: CommandMap = new Map<string, (uri:vscode.Uri) => void>([
  ["starlake.validate", runValidate],
  ["starlake.load", runLoad],
  ["starlake.previewJobQuery", previewJobQuery],
  ["starlake.runjob", runJob],
  ["starlake.runQuery", runQuery],
  ["starlake.yml2gv", runYml2gv],
  ["starlake.yml2xls", runYml2xls]
]);


let log = vscode.window.createOutputChannel("starlake log");
let currentEnv = "None"
let switchEnvItem: vscode.StatusBarItem
let selectedFormat = "table"
let selectedFormatItem: vscode.StatusBarItem
let config: ISettings
let projectItem: vscode.StatusBarItem;
let resourceClient: Resource = new Resource();
let client = new BigQuery()
let extensionContext: vscode.ExtensionContext;

function createStatusBarItem(priority: number): vscode.StatusBarItem {
    const alignment = vscode.StatusBarAlignment.Right;
    return vscode.window.createStatusBarItem(alignment, priority);
}

function createSwitchEnvItem(context: vscode.ExtensionContext): vscode.StatusBarItem
{
	switchEnvItem = createStatusBarItem(1);
    switchEnvItem.command = 'starlake.switchEnv';
    context.subscriptions.push(vscode.commands.registerCommand('starlake.switchEnv', async () => 
    {
		let envs = listEnvs()
        currentEnv = await vscode.window.showQuickPick(
            envs,
            { placeHolder: 'Select Env' }) || 'None';
		switchEnvItem.text = `Env(${currentEnv})`
		extensionContext.workspaceState.update('cometEnv', currentEnv);
    }));
	
	currentEnv = extensionContext.workspaceState.get('cometEnv') || 'None'
    switchEnvItem.text = `Starlake Env(${currentEnv})`;
    switchEnvItem.tooltip = `Starlake Env`;
    switchEnvItem.show();
	return switchEnvItem
}
function createSelectedFormatItem(context: vscode.ExtensionContext): vscode.StatusBarItem
{
	selectedFormatItem = createStatusBarItem(1);
    selectedFormatItem.command = 'starlake.selectFormat';
    context.subscriptions.push(vscode.commands.registerCommand('starlake.selectFormat', async () => 
    {
        selectedFormat = await vscode.window.showQuickPick(
            ['csv', 'json', 'table'],
            { placeHolder: 'Results Format' }) || 'table';
			selectedFormatItem.text = `Format(${selectedFormat})`

    }));
    context.subscriptions.push(selectedFormatItem);
    selectedFormatItem.text = `Format(table)`;
    selectedFormatItem.tooltip = `Query Results Format`;
    selectedFormatItem.show();
	return selectedFormatItem
}

function createProjectItem(context: vscode.ExtensionContext): vscode.StatusBarItem {
    const item = createStatusBarItem(1);
    item.command = "starlake.setProjectCommand";
	item.text = "No GCP project selected yet"
	vscode.commands.registerCommand(
		'starlake.setProjectCommand',
		() => setProjectCommand()
	)
	item.tooltip = `GCP project`
	item.show();
    return item;
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

function updateStatusBarItems(): void {
    updateProjectIdItem();
}

function updateProjectIdItem(): void {
    projectItem.text = getCurrentProjectId() || 'Choose Project'
}

function buildEnv(logLevel?: string) {
	let result = {
		env: {
			...process.env, 
			COMET_ROOT: vscode.workspace.workspaceFolders![0].uri.fsPath,
			COMET_METADATA: path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, "metadata"),
			COMET_ENV: currentEnv,
			SPARK_DIR: config.sparkDir,
			SPARK_HOME: config.sparkDir,
			COMET_BIN: config.starlakeBin,
			COMET_LOGLEVEL: logLevel || config.logLevel || 'INFO',
			GCLOUD_PROJECT: getCurrentProjectId() || "",
			TEMPORARY_GCS_BUCKET: config.googleCloudStorageTemporaryBucket || ""
		}
	}
	return result
}

function runValidate(uri:vscode.Uri): void {
	let validateOutput = ""
	if(vscode.workspace.workspaceFolders !== undefined) {
		let wf = vscode.workspace.workspaceFolders[0].uri.fsPath ;
		let metadataPath = path.join(wf, "metadata")
		if (fs.existsSync(metadataPath)) {
			logClear()
			let cmd = starlakeCmd()
			if (cmd) {
				let ls = child_process.spawn(cmd, ["validate"], buildEnv());
				ls.stdout.on('data', function (data) {
					log.append(data.toString())
					validateOutput += data.toString()
				});
				ls.stderr.on('data', function (data) {
					log.append(data.toString())
					validateOutput += data.toString()
				});
				ls.on('exit', function (code) {
					let startIndex = validateOutput.indexOf("START VALIDATION RESULTS: ")
					let endIndex = validateOutput.indexOf("END VALIDATION RESULTS")
					let errorFound = validateOutput.indexOf(" ERROR ") >=0
					if (startIndex >= 0 && endIndex > startIndex) {
						let validationData = validateOutput.substring(startIndex+"START VALIDATION RESULTS: ".length, endIndex)
						log.append(validationData)
					}
					else {
						log.append(validateOutput);
					}
					if (errorFound || code !== 0)
						vscode.window.showErrorMessage('Validation failed. See errors in log');
					else
						vscode.window.showInformationMessage('Validation succeeded');
				});
				validateOutput = ""
			}
		}
	}
}


function starlakeCmd(): string | undefined {
	if (!config.starlakeBin) {
		vscode.window.showErrorMessage("Set 'Starlake Bin' to the path of your starlake assembly")
	}
	else if (process.platform == 'win32') {
		return path.join(path.dirname(config.starlakeBin), "starlake.cmd")
	}
	else {
		return path.join(path.dirname(config.starlakeBin), "starlake.sh")
	}
}

function runLoad(uri:vscode.Uri): void {
	if(vscode.workspace.workspaceFolders !== undefined) {
		let wf = vscode.workspace.workspaceFolders[0].uri.fsPath ;
		let metadataPath = path.join(wf, "metadata")
		if (fs.existsSync(metadataPath)) {
			logClear()
			let cmd = starlakeCmd()
			if (cmd) {
				let ls = child_process.spawn(cmd, ["load"], buildEnv());
				ls.stdout.on('data', function (data) {
					log.append(data.toString());
				});
				ls.stderr.on('data', function (data) {
					log.append(data.toString());
				});
				ls.on('exit', function (code) {
					if (code !== 0)
						vscode.window.showErrorMessage('Load failed ' + code);
					else
						vscode.window.showInformationMessage('Load succeeded ' + code);
				});
			}
		}
	}
}


function runJob (uri:vscode.Uri): void {
	if(vscode.workspace.workspaceFolders !== undefined) {
		let wf = vscode.workspace.workspaceFolders[0].uri.fsPath ;
		let metadataPath = path.join(wf, "metadata")
		if (fs.existsSync(metadataPath)) {
			//vscode.window.showInformationMessage(wf);
			let currentlyOpenTabfilePath = uri ? uri.fsPath : vscode.window.activeTextEditor!.document.fileName;
			let currentlyOpenTabfileName = path.basename(currentlyOpenTabfilePath);
			let jobname = ""
			if (currentlyOpenTabfileName.endsWith(".comet.yml")) {
				jobname = currentlyOpenTabfileName.substring(0, currentlyOpenTabfileName.length - ".comet.yml".length)

			} else if (currentlyOpenTabfileName.endsWith(".sql")) {
				jobname = currentlyOpenTabfileName.substring(0, currentlyOpenTabfileName.length - ".sql".length)
				let index = jobname.indexOf('.')
				if (index > 0) {
					jobname =jobname.substring(0, index)
				}
			}
			else {
				return
			}
			logClear()
			let cmd = starlakeCmd()
			if (cmd) {
				let ls = child_process.spawn(cmd, ["transform", "--name", jobname], buildEnv());
				ls.stdout.on('data', function (data) {
					log.append(data.toString());
				});
				ls.stderr.on('data', function (data) {
					log.append(data.toString());
				});
				ls.on('exit', function (code) {
					if (code !== 0)
						vscode.window.showErrorMessage('Transform failed');
					else
						vscode.window.showInformationMessage('Transform success');
				});
			}
		}
	}
}

function previewJobQuery (uri:vscode.Uri): void {
		executeJobQuery(uri, true)
}

function executeJobQuery(uri:vscode.Uri, isDryRun?: boolean): void {
	let compileQueryData = ""
	if(vscode.workspace.workspaceFolders !== undefined) {
		let wf = vscode.workspace.workspaceFolders[0].uri.fsPath ;
		let metadataPath = path.join(wf, "metadata")
		if (fs.existsSync(metadataPath)) {
			//vscode.window.showInformationMessage(wf);
			let currentlyOpenTabfilePath = uri ? uri.fsPath : vscode.window.activeTextEditor!.document.fileName;
			let currentlyOpenTabfileName = path.basename(currentlyOpenTabfilePath);
			let jobname = ""
			if (currentlyOpenTabfilePath.indexOf("jobs") >=0) {
				if (currentlyOpenTabfileName.endsWith(".comet.yml")) {
					jobname = currentlyOpenTabfileName.substring(0, currentlyOpenTabfileName.length - ".comet.yml".length)

				} else if (currentlyOpenTabfileName.endsWith(".sql")) {
					jobname = currentlyOpenTabfileName.substring(0, currentlyOpenTabfileName.length - ".sql".length)
					let index = jobname.indexOf('.')
					if (index > 0) {
						jobname =jobname.substring(0, index)
					}
				} else {
					return
				}
			}
			else {
				return
			}
			logClear()
			log.append("Computing Job request ...")
			let cmd = starlakeCmd()
			if (cmd) {
				let ls = child_process.spawn(cmd, ["transform", "--name", jobname, "--compile"], buildEnv("INFO"));
				ls.stdout.on('data', function (data) {
					compileQueryData += data.toString()
				});
				ls.stderr.on('data', function (data) {
					compileQueryData += data.toString() 	
				});
				ls.on('exit', function (code) {				
					let startIndex = compileQueryData.indexOf("START COMPILE SQL")
					let endIndex = compileQueryData.indexOf("END COMPILE SQL")
					if (startIndex >= 0 && endIndex > startIndex) {
						let queryData = compileQueryData.substring(startIndex+'START COMPILE SQL'.length, endIndex)
						logClear()
						log.append("Computed Job request:\n")
						log.append(format(queryData))
						executeQuery(queryData, !!isDryRun)

					}
					else {
						log.append(compileQueryData);
					}
					compileQueryData = ""
					if (code !== 0)
						vscode.window.showErrorMessage('Transform failed');
				});
			}
		}
	}
}

function runYml2gv(uri:vscode.Uri): void {
	if(vscode.workspace.workspaceFolders !== undefined) {
		let wf = vscode.workspace.workspaceFolders[0].uri.fsPath;
		let metadataPath = path.join(wf, "metadata")
		let outPath = path.join(wf, "out")
		if (!fs.existsSync(outPath)) 
			fs.mkdirSync(outPath);
		if (fs.existsSync(metadataPath)) {
			logClear()
			log.append("Generating Data Graph ...")
			let cmd = starlakeCmd()
			let dataGraphPath = path.join(outPath, "datagraph.dot")
			if (cmd) {
				let ls = child_process.spawn(cmd, ["yml2gv", "--output", dataGraphPath], buildEnv("INFO"));
				ls.stdout.on('data', function (data) {
					log.append(data.toString())
				});
				ls.stderr.on('data', function (data) {
					log.append(data.toString())
				});
				ls.on('exit', function (code) {				
					if (code !== 0)
						vscode.window.showErrorMessage('Data Graph Generation failed');
					else {
						vscode.workspace.openTextDocument(vscode.Uri.parse(dataGraphPath)).then((a: vscode.TextDocument) => {
							vscode.commands.executeCommand('graphviz.preview', dataGraphPath);
							vscode.window.showInformationMessage(`Success: ${dataGraphPath}`);
							vscode.window.showInformationMessage("You may need to install a GraphViz extension");
						});
					} 
						
				});
			}
		}
	}
}

function runYml2xls(uri:vscode.Uri): void {
	if(vscode.workspace.workspaceFolders !== undefined) {
		let wf = vscode.workspace.workspaceFolders[0].uri.fsPath;
		let metadataPath = path.join(wf, "metadata");
		let outPath = path.join(wf, "out");
		if (!fs.existsSync(outPath))
			fs.mkdirSync(outPath);
		if (fs.existsSync(metadataPath)) {
			logClear();
			log.append("Generating Excel Files ...");
			let cmd = starlakeCmd();
			if (cmd) {
				let ls = child_process.spawn(cmd, ["yml2xls", "--xls", outPath], buildEnv("INFO"));
				ls.stdout.on('data', function (data) {
					log.append(data.toString())
				});
				ls.stderr.on('data', function (data) {
					log.append(data.toString())
				});
				ls.on('exit', function (code) {				
					if (code !== 0)
						vscode.window.showErrorMessage('Excel Files could not be generated');
					else
						vscode.window.showInformationMessage(`XLS files located in ${outPath}`);
				});
			}
		}
	}
}

function getCurrentProjectId(): string | undefined {
	const memento = extensionContext.workspaceState.get('bqProjectId');
    if (typeof memento === 'undefined') {
        client.getProjectId().then( 
			data => { // resolve() 
				setCurrentProjectId(data)				
			}, 
			error => { // reject() 
				console.log(error); 
			}
		);
        
    }
    return extensionContext.workspaceState.get('bqProjectId');
}

function setCurrentProjectId(projectId: string): void {
    extensionContext.workspaceState.update('bqProjectId', projectId);
    client.projectId = projectId;
    updateProjectIdItem();
    //dryRunAll();
}


function logClear() {
	log.clear()
	log.show()
}

function runQuery(uri:vscode.Uri): void {
	if(vscode.workspace.workspaceFolders !== undefined) {
		let wf = vscode.workspace.workspaceFolders[0].uri.fsPath;
		let metadataPath = path.join(wf, "metadata")
		if (fs.existsSync(metadataPath)) {
			logClear()
			let myUri = uri || vscode.window.activeTextEditor!.document.uri
			if (myUri.fsPath.endsWith(".comet.yml") && myUri.fsPath.indexOf("jobs") > 0) {
				executeJobQuery(uri, false)
			}
			let selection = vscode.window.activeTextEditor!.selection;
			let query = ""
			if (selection.isEmpty) 
				query = fs.readFileSync(myUri.fsPath, 'utf8');
			else 
				query = vscode.window.activeTextEditor!.document.getText(selection).trim();
				if(myUri.fsPath.endsWith(".sql") && myUri.fsPath.indexOf("jobs") > 0) {
					if (query.indexOf("${") >= 0 || query.indexOf("{{") >= 0)
					executeJobQuery(myUri, false)
					else
						executeQuery(query, false)
				}
		}
	}
}

function runDry (uri:vscode.Uri): void {
	if(vscode.workspace.workspaceFolders !== undefined) {
		let wf = vscode.workspace.workspaceFolders[0].uri.fsPath ;
		let metadataPath = path.join(wf, "metadata")
		if (fs.existsSync(metadataPath)) {
			let selection = vscode.window.activeTextEditor!.selection;
			let query = ""
			let myUri = uri || vscode.window.activeTextEditor!.document.uri
			if (selection.isEmpty) 
				query = query = fs.readFileSync(myUri.fsPath, 'utf8');
			else 
				query = vscode.window.activeTextEditor!.document.getText(selection).trim();
			executeQuery(query, true)
		}
	}
}

function executeQuery(queryText: string, isDryRun?: boolean) {
	client = new BigQuery({
	  projectId:  getCurrentProjectId()
	});
  
	let id: string | undefined;
	let job = client
	  .createQueryJob({
		query: queryText,
		useLegacySql: false,
		dryRun: isDryRun
	  })
	  .then(data => {
		let job = data[0];
		id = job.id;
		const jobIdMessage = `BigQuery job ID: ${job.id}`;
		let totalBytesProcessed = +job.metadata.statistics.totalBytesProcessed;
		let totalBytesStr = ""
		if (totalBytesProcessed < 1000)
			totalBytesStr = `${totalBytesProcessed}B`
		else if (totalBytesProcessed < 1000000)
			totalBytesStr = `${totalBytesProcessed / 1000} KB`
		else if (totalBytesProcessed < 1000000000)
			totalBytesStr = `${totalBytesProcessed / 1000000} MB`
		else
			totalBytesStr = `${totalBytesProcessed / 1000000000} GB`
		//dryRunItem.text = totalBytesStr
		vscode.window.showInformationMessage(`Dry run: ${totalBytesStr}`);
		if (!isDryRun)
			return job.getQueryResults({
			autoPaginate: true
			});
	  })
	  .catch(err => {
		extensionContext.workspaceState.update('bqProjectId', undefined);
		if (!isDryRun)
			vscode.window.showErrorMessage(`Failed to query BigQuery: ${err}`);
		return null;
	  });
  
	if (!isDryRun)
		return job
		.then(data => {
			if (data) {
			writeResults(id!, data[0]);
			}
		})
		.catch(err => {
			vscode.window.showErrorMessage(`Failed to get results: ${err}`);
		});
  }
  

function writeResults(jobId: string, rows: Array<any>): void {
	logClear()
	log.appendLine(`Results for job ${jobId}:`);

	let format = selectedFormat;

	switch (format) {
		case "csv":
			stringify(rows, (err, res) => {
			log.appendLine(res);
		});

		break;
		case "table":
		let t = new easyTable();

		// Collect the header names; flatten nested objects into a
		// recordname.recordfield format
		let headers:string[] = [];
		Object.keys(flatten(rows[0])).forEach(name => headers.push(name));

		rows.forEach((val, idx) => {
			// Flatten each row, and for each header (name), insert the matching
			// object property (v[name])
			let v = flatten(val, { safe: true });
			headers.forEach((name, col) => {
			t.cell(name, v[name]);
			});
			t.newRow();
		});

		log.appendLine(t.toString());

		break;
		default:
		rows.forEach(row => {
			log.appendLine(
			JSON.stringify(flatten(row, { safe: true }), null, "")
			);
		});
	}
}

function isStarlakeWorkspace() {
	if(vscode.workspace.workspaceFolders !== undefined) {
		let wf = vscode.workspace.workspaceFolders[0].uri.fsPath ;
		let metadataPath = path.join(wf, "metadata")
		return fs.existsSync(metadataPath)
	} 
	else {
		return false
	}
}

function listEnvs() {
	if(vscode.workspace.workspaceFolders !== undefined) {
		let wf = vscode.workspace.workspaceFolders[0].uri.fsPath ;
		let metadataPath = path.join(wf, "metadata")
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

    resourceClient.getProjects()
        .then(p => p[0])
        .then(ps => ps.map(p => p.id))
        .then(ps => vscode.window.showQuickPick(<string[]>ps))
        .then(p => {
            if (typeof (p) !== 'undefined') {
                setCurrentProjectId(p);
            }
        })
        .catch(error => vscode.window.showErrorMessage(error.message));
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    extensionContext = context;
	config = loadConfig("starlake");
	if (isStarlakeWorkspace()) {
		dryRunSubscribe(context);
		switchEnvItem = createSwitchEnvItem(context)
		selectedFormatItem = createSelectedFormatItem(context)
		projectItem = createProjectItem(context);
		updateStatusBarItems();
		commands.forEach((action, name) => {
			context.subscriptions.push(vscode.commands.registerCommand(name, action));
		});
		context.subscriptions.push(
			vscode.workspace.onDidChangeConfiguration(event => {
			  if (!event.affectsConfiguration("starlake")) {
				return;
			  }
			  config = loadConfig("starlake");
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
	} else {
		vscode.window.showErrorMessage("Invalid Workspace folder. Please make sure you open a valid starlake project")
	}
}

// this method is called when your extension is deactivated
export function deactivate() {}


/////////////////////////////////////////
/////////////////////////////////////////
/////////////////////////////////////////
/////////////////////////////////////////

function loadEnv(): Map<string, string> {
    const rootFolder = vscode.workspace.workspaceFolders![0].uri.fsPath
	let metadataPath = path.join(rootFolder, "metadata")
	let envPath = path.join(metadataPath, "env.comet.yml")
	let result = new Map<string, string>()
	if (fs.existsSync(envPath)) {
		const content = fs.readFileSync(envPath, 'utf8')
		let envObject = parseYaml(content)
		Object.entries(envObject.env).forEach(
			([key, value]) => result.set(key, value as string)
		);
	}
	
	if (currentEnv != 'None') {
		let currentEnvPath = path.join(metadataPath, `env.${currentEnv}.comet.yml`)
		if (fs.existsSync(currentEnvPath)) {
			const content = fs.readFileSync(currentEnvPath, 'utf8')
			let currentEnvObject = parseYaml(content)
			Object.entries(currentEnvObject.env).forEach(
				([key, value]) => result.set(key, value as string)
			);
		}
	}

	return result
}



function getEngine(jobPath: string): any {
	if (fs.existsSync(jobPath)) {
		const content = fs.readFileSync(jobPath, 'utf8')
		let jobObject = parseYaml(content)
		if (jobObject.transform) {
			let engine = jobObject.transform.engine as string
			if (engine.indexOf("}") > 0) {
				let engineVar = engine.replace("${", "").replace("{{", "").replace("}", "")
				let engineValue = loadEnv().get(engineVar)
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

