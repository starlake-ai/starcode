import { BigQuery } from '@google-cloud/bigquery';
import { Resource } from '@google-cloud/resource';
import * as vscode from 'vscode';
import { OutputChannel } from "vscode";
import { ISettings } from './settings';
import * as path from 'path';
import * as fs from 'fs';
import { ChildProcessWithoutNullStreams } from 'child_process';
import * as child_process from 'child_process';


export class Globals {
    log: OutputChannel = vscode.window.createOutputChannel("starlake log");
    currentEnv: string = "None"
    switchEnvItem: vscode.StatusBarItem = this.createStatusBarItem(1);
    selectedFormatItem: vscode.StatusBarItem = this.createStatusBarItem(1);
    projectItem: vscode.StatusBarItem= this.createStatusBarItem(1);
    selectedFormat: string = "table"
    config!: ISettings;
    resourceClient: Resource = new Resource();
    client = new BigQuery()
    extensionContext!: vscode.ExtensionContext;

    private buildEnv(logLevel?: string, subst?: string) {
        let result = {
            env: {
                COMET_ROOT: vscode.workspace.workspaceFolders![0].uri.fsPath,
                COMET_METADATA: path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, globals.config.metadataDir),
                COMET_ENV: globals.currentEnv,
                SPARK_DIR: globals.config.sparkDir,
                SPARK_HOME: globals.config.sparkDir,
                COMET_BIN: globals.config.starlakeBin,
                COMET_LOGLEVEL: logLevel || globals.config.logLevel || 'INFO',
                GCLOUD_PROJECT: this.getCurrentProjectId() || "",
                TEMPORARY_GCS_BUCKET: globals.config.googleCloudStorageTemporaryBucket || "",
                COMET_INTERNAL_SUBSTITUTE_VARS: subst || "true"
            }
        }
        return result
    }
    
    getCurrentProjectId(): string | undefined {
        const memento = globals.extensionContext.workspaceState.get('bqProjectId');
        if (typeof memento === 'undefined') {
            this.client.getProjectId().then( 
                data => { // resolve() 
                    this.setCurrentProjectId(data)				
                }, 
                error => { // reject() 
                    console.log(error); 
                }
            );
            
        }
        return globals.extensionContext.workspaceState.get('bqProjectId');
    }
    
    setCurrentProjectId(projectId: string): void {
        globals.extensionContext.workspaceState.update('bqProjectId', projectId);
        globals.client.projectId = projectId;
        this.updateProjectIdItem();
        //dryRunAll();
    }

    private updateProjectIdItem(): void {
        this.projectItem.text = this.getCurrentProjectId() || 'Choose Project'
    }
    updateStatusBarItems(): void {
        this.updateProjectIdItem();
    }
    
    
    spawn(cmd: string, args: Array<string>, logLevel?: string, subst?: string): ChildProcessWithoutNullStreams {
        var cmdLine = args.slice();
        cmdLine.unshift(cmd);
        let env = this.buildEnv(logLevel, subst)
        let completeEnv = {
            ...process.env, 
            ...env
        }
    
        globals.log.append("\n--------\n")
        globals.log.append(JSON.stringify(env,null,2))
        globals.log.append("\n\n")
        globals.log.append(cmdLine.join(' '))
        globals.log.append("\n--------\n")
    
        if (process.platform == 'win32') {
            return child_process.spawn(cmd, args, completeEnv);
        }
        else {
            args.unshift(cmd)
            return child_process.spawn("sh", args, completeEnv);
        }
        
    }
    
    starlakeCmd():   string | undefined {
        let res = ""
        if (!globals.config.starlakeBin) {
            vscode.window.showErrorMessage("Set 'Starlake Bin' to the path of your starlake assembly")
        }
        else if (process.platform == 'win32') {
            res = path.join(this.extensionContext.extensionPath, "vscode-extension", "starlake.cmd")
        }
        else {
            res = path.join(this.extensionContext.extensionPath, "vscode-extension", "starlake.sh")
        }
        if (!fs.existsSync(res))
            vscode.window.showErrorMessage(`Path ${res} not found`);
        
        return res
    }

    logClear(): void {
        globals.log.clear()
        globals.log.show()
    }
    
    
    private createStatusBarItem(priority: number): vscode.StatusBarItem {
        const alignment = vscode.StatusBarAlignment.Right;
        return vscode.window.createStatusBarItem(alignment, priority);
    }
    
    
}

export const globals = new Globals();



