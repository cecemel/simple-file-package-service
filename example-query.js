import { querySudo as query } from '@lblod/mu-auth-sudo';

import { uuid } from 'mu';

const fileQuery = async function( jobsParams ){
  //Get some files valid for your system. You can do any query.
  let result = await query(`
        PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
        PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
        PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>

        SELECT ?file ?filename WHERE {

        ?file mu:uuid ?uuid.
        ?file nie:dataSource ?logicalFile.
        ?logicalFile nfo:fileName ?filename.

        FILTER( ?uuid in ("${jobsParams["uuid1"]}", "${jobsParams["uuid2"]}"))
       }
  `);

  let files = result.results.bindings || [];

  //A pacakgeName is needed = combining JS and SparqlIsFun wieee
  return {files, packageName: `${new Date().toISOString()}_${uuid()}.zip`};
};

export default fileQuery;
