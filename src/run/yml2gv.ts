
import * as vscode from 'vscode';
import * as fs from 'fs';
import { globals } from '../globals'
import * as path from 'path';

export function runYml2gv(uri:vscode.Uri): void {
	if(vscode.workspace.workspaceFolders !== undefined) {
		let wf = vscode.workspace.workspaceFolders[0].uri.fsPath;
		let metadataPath = path.join(wf, globals.config.metadataDir)
		let outPath = path.join(wf, "out")
		if (!fs.existsSync(outPath)) 
			fs.mkdirSync(outPath);
		if (fs.existsSync(metadataPath)) {
			globals.logClear()
			globals.log.append("Generating Data Graph ...")
			let cmd = globals.starlakeCmd()
			let dataGraphPath = path.join(outPath, "datagraph.dot")
			if (cmd) {
				let ls = globals.spawn(cmd, ["yml2gv", "--output", dataGraphPath], "INFO");
				ls.stdout.on('data', function (data) {
					  globals.log.append(data.toString())
				});
				ls.stderr.on('data', function (data) {
					globals.log.append(data.toString())
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


