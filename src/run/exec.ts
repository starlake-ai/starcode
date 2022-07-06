import * as vscode from 'vscode';
import * as fs from 'fs';
import { globals } from '../globals'
import * as path from 'path';
const { flatten } = require('safe-flat')
import { format } from 'sql-formatter';
import { BigQuery } from '@google-cloud/bigquery';
import { stringify } from 'csv-stringify';
import easyTable = require("easy-table");

export function executeJobQuery(uri:vscode.Uri, isDryRun?: boolean): void {
	let compileQueryData = ""
	if(vscode.workspace.workspaceFolders !== undefined) {
		let wf = vscode.workspace.workspaceFolders[0].uri.fsPath ;
		let metadataPath = path.join(wf, globals.config.metadataDir)
		if (fs.existsSync(metadataPath)) {
			//vscode.window.showInformationMessage(wf);
			let currentlyOpenTabfilePath = uri ? uri.fsPath : vscode.window.activeTextEditor!.document.fileName;
			let currentlyOpenTabfileName = path.basename(currentlyOpenTabfilePath);
			let jobname = ""
			if (currentlyOpenTabfilePath.indexOf("jobs") >=0) {
				if (currentlyOpenTabfileName.endsWith(".comet.yml")) {
					jobname = currentlyOpenTabfileName.substring(0, currentlyOpenTabfileName.length - ".comet.yml".length)

				} else if (currentlyOpenTabfileName.endsWith(".sql")) {
					let cometYaml = currentlyOpenTabfilePath.substring(0, currentlyOpenTabfilePath.length -"sql".length) + "comet.yml"
					if (fs.existsSync(cometYaml)) {
						jobname = currentlyOpenTabfileName.substring(0, currentlyOpenTabfileName.length - ".sql".length)
						let index = jobname.indexOf('.')
						if (index > 0) {
							jobname =jobname.substring(0, index)
						}
					}
 					else {
						let selection = vscode.window.activeTextEditor!.selection;
						let query = ""
						let myUri = uri || vscode.window.activeTextEditor!.document.uri
						if (selection.isEmpty) 
							query = query = fs.readFileSync(myUri.fsPath, 'utf8');
						else 
							query = vscode.window.activeTextEditor!.document.getText(selection).trim();
						executeQuery(query, !!isDryRun)
						return
					}
				}
				else {
					return
				}
			}
			else {
				return
			}
			globals.logClear()
			globals.log.append("Computing Job request ...")
			let cmd = globals.starlakeCmd()
			if (cmd) {
				try {
				let ls = globals.spawn(cmd, ["transform", "--name", jobname, "--compile"], "INFO");
				ls.on('error',function (err) {
					console.log('Failed to start child process.');
				});
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
						globals.logClear()
						globals.log.append("Computed Job request:\n")
						globals.log.append(format(queryData))
						executeQuery(queryData, !!isDryRun)

					}
					else {
						globals.log.append(compileQueryData);
					}
					compileQueryData = ""
					if (code !== 0)
						vscode.window.showErrorMessage('Transform failed');
				});
			} catch(e: any){
				console.log(e.Message);
			}
			}
		}
	}
}

export function executeQuery(queryText: string, isDryRun?: boolean) {
	globals.client = new BigQuery({
	  projectId:  globals.getCurrentProjectId()
	});
  
	let id: string | undefined;
	let job = globals.client
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
		globals.extensionContext.workspaceState.update('bqProjectId', undefined);
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
	globals.logClear()
	globals.log.appendLine(`Results for job ${jobId}:`);

	switch (globals.selectedFormat) {
		case "csv":
			stringify(rows, (err, res) => {
			globals.log.appendLine(res);
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

		globals.log.appendLine(t.toString());

		break;
		default:
		rows.forEach(row => {
			globals.log.appendLine(
			JSON.stringify(flatten(row, { safe: true }), null, "")
			);
		});
	}
}
