import * as vscode from 'vscode';
import { executeJobQuery } from './exec'

export function previewJobQuery (uri:vscode.Uri): void {
    executeJobQuery(uri, true)
}
