# starcode README

## Features

* Domain / Jobs / Types validation
* Dry Run of YAML Jobs / SQL scripts
* Preview Prettyfied Queries
* Run Jobs

## Installation
- Download Spark from https://spark.apache.org
- Download Starlake assembly from https://s01.oss.sonatype.org/content/repositories/releases/ai/starlake/
- Download starlake.cmd on Windows or starlake.sh on MacOs / Linux from https://github.com/starlake-ai/starlake/tree/master/cli and copy it in the directory where you downloaded the Starlake assembly

Profit.

## About Google Cloud Setup
To list your Google Cloud projects, you first need to set your default application credentials

$ gcloud auth application-default login
## Extension Settings

This extension contributes the following settings:

* `starlake.sparkDir`: Reference the folder Where your Spark binaries are installed
* `starlake.cometBin`: Reference directly your starlake assembly
* `starlake.googleCloudStorageTemporaryBucket`: Temporary bucket to use when syncing to BigQuery (without the gs:// prefix)
* `starlake.logLevel`: One of the level supported by for Log4J

## Release Notes

### 0.0.1

Initial release
