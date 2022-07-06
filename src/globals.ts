import * as vscode from 'vscode';
import { OutputChannel } from "vscode";


export class Globals {
    log: OutputChannel = vscode.window.createOutputChannel("starlake log");
    currentEnv: string = "None"
}

export const globals = new Globals();

