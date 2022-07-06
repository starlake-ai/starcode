import * as vscode from 'vscode';
import * as fs from 'fs';
import { globals } from '../globals'
import * as path from 'path';
import { executeJobQuery, executeQuery } from './exec'

export function runQuery(uri:vscode.Uri): void {
	if(vscode.workspace.workspaceFolders !== undefined) {
		let wf = vscode.workspace.workspaceFolders[0].uri.fsPath;
		let metadataPath = path.join(wf, globals.config.metadataDir)
		if (fs.existsSync(metadataPath)) {
			globals.logClear()
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
