# simple-file-package-service
Given a configured query which returns an array of fileUri's fetchThe associated Files to package them in a zip.
# API
## Assumptions
The files are stored according to the model [mu-file-service](https://github.com/mu-semtech/file-service)
The service is based on [mu-javascript-template](https://github.com/mu-semtech/mu-javascript-template).
## Query config.
Query is configured in a javacsript file. 

## REST
```
POST /package-files
```
Triggers the packaging.
