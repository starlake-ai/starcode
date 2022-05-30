# starcode README

## Features

* Domain / Jobs / Types validation
* Dry Run of YAML Jobs / SQL scripts
* Preview Prettyfied Queries
* Run Jobs

## Installation

Installation via the Visual Studio Code Marketplace is not yet available. Sorry for that. However, the manual installation is not that complicated:

Download the latest VSIX file from GitHub.
Press CTRL-Shift-P and select Extensions: Install from VSIX... (type ext vsix).
Select the downloaded VSIX file.
Profit.

## Extension Settings

This extension contributes the following settings:

* `starcode.sparkDir`: Where are your Spark binaries installed
* `starcode.cometBin`: Reference to your starlake assembly
* `starcode.googleCloudStorageTemporaryBucket`: Temporary bucket to use when syncing to BigQuery
* `starcode.logLevel`: One of the level supported by for Log4J

## Release Notes

### 0.0.1

Initial release


