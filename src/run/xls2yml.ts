import * as vscode from 'vscode';
import * as fs from 'fs';
import { globals } from '../globals'
import * as path from 'path';

export function runXls2yml(uri:vscode.Uri): void {
	if(vscode.workspace.workspaceFolders !== undefined) {
		let wf = vscode.workspace.workspaceFolders[0].uri.fsPath;
		let metadataPath = path.join(wf, globals.config.metadataDir);
		let currentlyOpenTabfilePath = uri ? uri.fsPath : vscode.window.activeTextEditor!.document.fileName;
		let outPath = path.join(wf, "out");
		if (!fs.existsSync(outPath))
			fs.mkdirSync(outPath);
		if (fs.existsSync(metadataPath)) {
			globals.logClear();
			globals.log.append("Generating Domain Files ...");
			let cmd = globals.starlakeCmd();
			if (cmd) {
				let ls = globals.spawn(cmd, ["xls2yml", "--files", currentlyOpenTabfilePath, "--encryption", "false"], "INFO");
				ls.stdout.on('data', function (data) {
					globals.log.append(data.toString())
				});
				ls.stderr.on('data', function (data) {
					globals.log.append(data.toString())
				});
				ls.on('exit', function (code) {				
					if (code !== 0)
						vscode.window.showErrorMessage('YML  Files could not be generated');
					else
						vscode.window.showInformationMessage(`YML files located in ${path.join(globals.config.metadataDir, "domains")}`);
				});
			}
		}
	}
}
