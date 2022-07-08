
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {parse as parseYaml} from 'yaml';

export function loadEnv(metadataDir: string, currentEnv: string): Map<string, string> {
    const rootFolder = vscode.workspace.workspaceFolders![0].uri.fsPath
	let metadataPath = path.join(rootFolder, metadataDir)
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


export function getEngine(jobPath: string): any {
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
