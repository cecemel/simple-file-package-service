# simple-file-package-service
Given a configured query which returns an array of fileUri's fetchThe associated Files to package them in a zip.
# API
## Assumptions
The files are stored according to the model [mu-file-service](https://github.com/mu-semtech/file-service)
The service is based on [mu-javascript-template](https://github.com/mu-semtech/mu-javascript-template).

## Query config.
Query is configured in a javascript file. It should comply to the following structure.
(This is more an example then a spec. The picture is clear right?)
```
import { querySudo as query, updateSudo as update } from './auth-sudo';
import { uuid } from 'mu';

const fileQuery = async function( jobsParamsProvidedAsQueryParams ){
  //Get some files valid for your system. You can do any query.
  let result = await query(`
        SELECT ?file ?filename WHERE {
        //Make sure you have ?file and ?fileName
       }
  `);
  return {files: result.results.bindings || [], packageName: `${new Date().toISOString()}_${uuid()}.zip`};
};

export default fileQuery;
```
## REST
### create job
```
curl -d '{"whatever":"json", "data":"you need"}' -H "Content-Type: application/json" -X POST http://localhost/simple-file-package-jobs
```
This will create a job that will be picked up asynchronously.

### trigger packaging
If you want to trigger the packaging pipeline manually.
```
curl -H "Content-Type: application/json" -X POST http://localhost/simple-file-package-pipeline
```

## In your docker-compose.yml
Defaults of the options are provided.
```
services:
  simple-file-package-service:
    image: cecemel/simple-file-package-service:0.1.0
    environment:
      TARGET_FOLDER: "/data/files" # [optional: if you need your packages to be stored elsewhere]
      DATA_FOLDER: "/data/files/" # [optional]
      PACKAGE_GRAPH: 'http://mu.semte.ch/graphs/simple-file-package-service' # [optional: graph were jobs are stored]
      HOURS_DELIVERING_TIMEOUT: '3' # [optional: when do you consider a job hanging]
    links:
    - database:database # [optional]
    volumes:
      - ./data/files:/data/files # [optional]
      - ./the/path/to/your/query-script.js:/app/file-query.js # [required]
```
### Example
An example query is provided: see file ```example-query.js ```
