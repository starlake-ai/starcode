
import * as vscode from 'vscode';
import * as fs from 'fs';
import { globals } from '../globals'
import * as path from 'path';

export function runLoad(uri:vscode.Uri): void {
	if(vscode.workspace.workspaceFolders !== undefined) {
		let wf = vscode.workspace.workspaceFolders[0].uri.fsPath ;
		let metadataPath = path.join(wf, globals.config.metadataDir)
		if (fs.existsSync(metadataPath)) {
			globals.logClear()
			let cmd = globals.starlakeCmd()
			if (cmd) {
				let ls = globals.spawn(cmd, ["load"]);
				ls.stdout.on('data', function (data) {
					globals.log.append(data.toString());
				});
				ls.stderr.on('data', function (data) {
					globals.log.append(data.toString());
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


