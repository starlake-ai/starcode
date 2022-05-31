import * as vscode from 'vscode';

export interface ISettings {
    sparkDir?: string,
    starlakeBin?: string
    googleCloudStorageTemporaryBucket?: string,
    logLevel?: string,
}


function getOrElse(configuration: vscode.WorkspaceConfiguration, key: string, els:string) {
    let val = configuration.get<string>(key, els)
    return !val ||  val.length == 0 ? els : val

}
export function loadConfig(myPluginId: string): ISettings {
    let configuration = vscode.workspace.getConfiguration(myPluginId);
    return {
        sparkDir: getOrElse(configuration, "sparkDir", "/Users/hayssams/git/public/starcode/scripts/bin/spark-3.2.1-bin-hadoop3.2"),
        starlakeBin: getOrElse(configuration, "starlakeBin", "/Users/hayssams/git/public/starcode/scripts/bin/starlake-spark3_2.12-0.3.17-SNAPSHOT-assembly.jar"),
        googleCloudStorageTemporaryBucket: getOrElse(configuration, "googleCloudStorageTemporaryBucket", "starlake-app"),
        logLevel: getOrElse(configuration, "logLevel", "INFO")
    }
}


