
import * as vscode from 'vscode';
import * as fs from 'fs';
import { globals } from '../globals'
import * as path from 'path';

export function runJob (uri:vscode.Uri): void {
	if(vscode.workspace.workspaceFolders !== undefined) {
		let wf = vscode.workspace.workspaceFolders[0].uri.fsPath ;
		let metadataPath = path.join(wf, globals.config.metadataDir)
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
			globals.logClear()
			let cmd = globals.starlakeCmd()
			if (cmd) {
				let ls = globals.spawn(cmd, ["transform", "--name", jobname]);
				ls.stdout.on('data', function (data) {
					globals.log.append(data.toString());
				});
				ls.stderr.on('data', function (data) {
					globals.log.append(data.toString());
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