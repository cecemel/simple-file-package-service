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
import { querySudo as query } from '@lblod/mu-auth-sudo';
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
This will create a job that will be picked up in an asynchronous way.

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
      HOURS_DELIVERING_TIMEOUT: '3' # [optional: when do you consider a job hanging?]
      PACKAGE_CRON_PATTERN: '*/10 * * * * *' # [optional]
    links:
    - database:database # [optional]
    volumes:
      - ./data/files:/data/files # [optional]
      - ./the/path/to/your/query-script.js:/app/file-query.js # [required]
```
### Example
An example query is provided: see file ```example-query.js ```

## TODO
There is an error with [seas](https://github.com/mu-semtech/authorization-service).
Select query gives. Can it be related with the fact the graph is not defined in SEAS?
```
database_1                                | Request: POST /sparql
database_1                                | ** (exit) an exception was raised:
database_1                                |     ** (MatchError) no match of right hand side value: nil
database_1                                |         (mu-authorization) lib/interpreter/cached_interpreter.ex:37: Interpreter.CachedInterpreter.parse_query_full/3
database_1                                |         (mu-authorization) lib/parser.ex:27: Parser.parse_query_full/3
database_1                                |         (mu-authorization) lib/sparql_server/sparql_server_router.ex:115: SparqlServer.Router.handle_query/3
database_1                                |         (mu-authorization) lib/sparql_server/sparql_server_router.ex:43: anonymous fn/1 in SparqlServer.Router.do_match/4
database_1                                |         (mu-authorization) lib/sparql_server/sparql_server_router.ex:1: SparqlServer.Router.plug_builder_call/2
database_1                                |         (plug) lib/plug/adapters/cowboy2/handler.ex:12: Plug.Adapters.Cowboy2.Handler.init/2
database_1                                |         (cowboy) /app/deps/cowboy/src/cowboy_handler.erl:37: :cowboy_handler.execute/2
database_1                                |         (cowboy) /app/deps/cowboy/src/cowboy_stream_h.erl:274: :cowboy_stream_h.execute/3

```
