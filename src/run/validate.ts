
import * as vscode from 'vscode';
import * as fs from 'fs';
import { globals } from '../globals'
import * as path from 'path';


export function runValidate(uri:vscode.Uri): void {
	let validateOutput = ""
	if(vscode.workspace.workspaceFolders !== undefined) {
		let wf = vscode.workspace.workspaceFolders[0].uri.fsPath ;
		let metadataPath = path.join(wf, globals.config.metadataDir)
		if (fs.existsSync(metadataPath)) {
			globals.logClear()
			let cmd = globals.starlakeCmd()
			if (cmd) {
				let outPath = path.join(wf, "out")
				if (!fs.existsSync(outPath)) 
				fs.mkdirSync(outPath);
				let runLog = path.join(outPath, "run.log")
				const runLogFd = fs.openSync(runLog, 'w')
				fs.closeSync(runLogFd)
				let ls = globals.spawn(cmd, ["validate"]);
				ls.stdout.on('data', function (data) {
					let dataStr = data.toString()
					globals.log.append(dataStr)
					validateOutput += dataStr
					fs.appendFileSync(runLog, dataStr)
					});
				ls.stderr.on('data', function (data) {
					let dataStr = data.toString()
					globals.log.append(dataStr)
					validateOutput += dataStr
					fs.appendFileSync(runLog, dataStr)
				});
				ls.on('exit', function (code) {
					let startIndex = validateOutput.indexOf("START VALIDATION RESULTS: ")
					let endIndex = validateOutput.indexOf("END VALIDATION RESULTS")
					let errorFound = startIndex >= 0 && validateOutput.indexOf("0 errors found") != startIndex + "START VALIDATION RESULTS: ".length
					if (startIndex >= 0 && endIndex > startIndex) {
						let validationData = validateOutput.substring(startIndex+"START VALIDATION RESULTS: ".length, endIndex)
						globals.log.append(validationData)
					}
					else {
						globals.log.append(validateOutput);
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