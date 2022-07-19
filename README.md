# starcode README

## Features

* Domain / Jobs / Types validation
* Dry Run of YAML Jobs / SQL scripts
* Preview Prettyfied Queries
* Run Jobs

## Installation

* Download and install Spark from https://spark.apache.org. Windows users should make sure that `winutils.exe` is present in the PATH.
* Download Starlake assembly from https://s01.oss.sonatype.org/content/repositories/releases/ai/starlake/

Profit.

## Useful extensions to install

* Log Output Colorizer: https://marketplace.visualstudio.com/items?itemName=IBM.output-colorizer
* GraphViz (dot) language support: https://marketplace.visualstudio.com/items?itemName=joaompinto.vscode-graphviz

## About Google Cloud Setup

Make sure that the gcloud command is present in your PATH: This is a requirement for the GCloud API to work.


To list your Google Cloud projects, you first need to set your default application credentials

`$ gcloud auth application-default login`

Then set a default project 

`$ gcloud config set core/project MY_PROJECT_ID` 


## Extension Settings

This extension contributes the following settings:

* `starlake.sparkDir`: Reference the folder Where your Spark binaries are installed
* `starlake.cometBin`: Reference directly your starlake assembly
* `starlake.googleCloudStorageTemporaryBucket`: Temporary bucket to use when syncing to BigQuery (without the gs:// prefix)
* `starlake.logLevel`: One of the level supported by for Log4J
* `starlake.metadataDir`: Metadata folder name. "metadata" by default

## Release Notes

### 0.1.6

- Improve format handling
- Check for starlake min version

### 0.0.1

Initial release
