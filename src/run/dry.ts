import * as vscode from 'vscode';
import { executeQuery } from './exec'
import * as fs from 'fs';
import * as path from 'path';
import { globals } from '../globals'

export function runDry (uri:vscode.Uri): void {
	if(vscode.workspace.workspaceFolders !== undefined) {
		let wf = vscode.workspace.workspaceFolders[0].uri.fsPath ;
		let metadataPath = path.join(wf, globals.config.metadataDir)
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
