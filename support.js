import { uuid, sparqlEscapeString, sparqlEscapeDateTime, sparqlEscapeUri } from 'mu';
import { querySudo as query, updateSudo as update } from './auth-sudo';
import path from 'path';
import fs from 'fs-extra';
import archiver from 'archiver';
import fileQuery from './file-query';


const DATA_FOLDER = process.env.DATA_FOLDER || '/data/files/';
const TARGET_FOLDER = process.env.TARGET_FOLDER || '/data/files/';
const PACKAGE_GRAPH = process.env.PACKAGE_GRAPH || 'http://mu.semte.ch/graphs/simple-file-package-service';
const HOURS_DELIVERING_TIMEOUT =  process.env.HOURS_DELIVERING_TIMEOUT || 3;
const PREFIX = "http://mu.semte.ch/vocabularies/ext/simple-file-package-service/";
const JOBURIBASE = `${PREFIX}job/`;


// Statuses
const SCHEDULED = `${PREFIX}SCHEDULED`;
const PACKAGING = `${PREFIX}PACKAGING`;
const PACKAGED = `${PREFIX}PACKAGED`;
const FAILED = `${PREFIX}PACKAGING_FAILED`;
const NO_FILES = `${PREFIX}NO_FILES`;

const scheduleJob = async function( queryParams ){
  let jobUuid = uuid();
  let jobUri = JOBURIBASE + jobUuid;
  await createJob(jobUri, jobUuid, JSON.stringify(queryParams));
  return jobUri;
};

const runPipeline = async function(){
  // We don't want hanging jobs, log em as failed
  try {
    await cleanHangingJobs();
    let jobs = await getJobsByStatus(SCHEDULED);
    for(let j of jobs){
      try{
        await updateJobStatus(j.uri.value, PACKAGING);
        let result = await fileQuery(JSON.parse(j.params.value));

        if(result.files.length === 0){
          await updateJobStatus(j.uri.value, NO_FILES);
          return;
        }

        let packageName = result.packageName;
        if(!packageName) throw Error(`Expected field 'packageName' for ${JSON.stringify(result)}.`);

        let zipFileUri = await createZipFile(packageName, result.files);
        await addFileUri(j.uri.value, zipFileUri);
        await updateJobStatus(j.uri.value, PACKAGED);
      }

      catch(e){
        console.error(`Error with job ${j.uri.value}`);
        console.error(e.message);
        await updateJobStatus(j.uri.value, FAILED);

      }
    }
  }
  catch(e){
    console.error(`General error whilst running pipeline`);
    console.error(e.message);
  }
};

/**
 * create zip file in packagePath with the provided name(.zip),
 * containing the provided files and metadata
 * @method createZipFile
 */
const createZipFile = async function(name, files) {
  const filename = path.join(TARGET_FOLDER, name);
  var output = await fs.createWriteStream(filename);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level.
  });
  // listen for all archive data to be written
  // 'close' event is fired only when a file descriptor is involved
  output.on('close', function() {
    console.log(`${filename} was created: ${archive.pointer()} bytes`);
  });
  // good practice to catch warnings (ie stat failures and other non-blocking errors)
  archive.on('warning', function(err) {
      throw err;
  });

  // good practice to catch this error explicitly
  archive.on('error', function(err) {
    throw err;
  });
  archive.pipe(output);
  files.map( (file) => {
    const filename = normalizeFileName(file.filename.value);
    archive.file(fileUrlToPath(file.file.value, DATA_FOLDER), {name: filename});
  });
  await archive.finalize();
  return pathToFileUrl(filename, TARGET_FOLDER);
};

const getJobsByStatus = async function(status){
  let queryString = `
    PREFIX    pck: <${PREFIX}>
    PREFIX    mu: <http://mu.semte.ch/vocabularies/core/>

    SELECT DISTINCT ?uri, ?uuid, ?params, ?modified, ?created WHERE {
      GRAPH ${sparqlEscapeUri(PACKAGE_GRAPH)} {
         ?uri a pck:SimpleFilePackageJob;
              mu:uuid ?uuid;
              pck:params ?params;
              pck:created ?created;
              pck:status ${sparqlEscapeUri(status)}.
         ?uri pck:modified ?modified.
      }
    }
  `;
  const result = await query(queryString);
  return (result.results || {}).bindings || [];
};

const createJob = async function (jobUri, jobUuid, jobParams) {
  await query(`
    PREFIX    pck: <${PREFIX}>
    PREFIX    mu: <http://mu.semte.ch/vocabularies/core/>
    INSERT DATA {
      GRAPH ${sparqlEscapeUri(PACKAGE_GRAPH)} {
         ${sparqlEscapeUri(jobUri)} a pck:SimpleFilePackageJob;
              pck:status ${sparqlEscapeUri(SCHEDULED)};
              mu:uuid ${sparqlEscapeString(jobUuid)};
              pck:params ${sparqlEscapeString(jobParams)};
              pck:created ${sparqlEscapeDateTime(new Date())};
              pck:modified ${sparqlEscapeDateTime(new Date())}.
      }
    }`);
  return jobUri;
};

const addFileUri = async function (jobUri, zipFileUri){
  await query(`
    PREFIX    pck: <${PREFIX}>
    PREFIX    mu: <http://mu.semte.ch/vocabularies/core/>
    INSERT DATA{
      GRAPH ${sparqlEscapeUri(PACKAGE_GRAPH)} {
         ${sparqlEscapeUri(jobUri)} pck:packageFile ${sparqlEscapeUri(zipFileUri)}.
      }
    }
   `);
};

const updateJobStatus = async function (jobUri, status){
  let q = `
    PREFIX    pck: <${PREFIX}>
    PREFIX    mu: <http://mu.semte.ch/vocabularies/core/>
    DELETE {
      GRAPH ${sparqlEscapeUri(PACKAGE_GRAPH)} {
        ${sparqlEscapeUri(jobUri)} pck:status ?currStatus;
                                   pck:modified ?modified.
      }
    }
    INSERT {
      GRAPH ${sparqlEscapeUri(PACKAGE_GRAPH)} {
         ${sparqlEscapeUri(jobUri)} pck:status ${sparqlEscapeUri(status)};
                                    pck:modified ${sparqlEscapeDateTime(new Date())}.
      }
    }
    WHERE {
      GRAPH ${sparqlEscapeUri(PACKAGE_GRAPH)} {
         ${sparqlEscapeUri(jobUri)} pck:status ?currStatus.
         ${sparqlEscapeUri(jobUri)} pck:modified ?modified.
      }
    }`;
  await query(q);
};

const cleanHangingJobs = async function (){
  let jobs = await getJobsByStatus(PACKAGING);
  let hangingJobs = jobs.filter(filterDeliveringTimeout);
  for(let j of hangingJobs){
    await updateJobStatus(j.uri, FAILED);
  }
};

const filterDeliveringTimeout = function( job ) {
  let modifiedDate = new Date(job.modified);
  let currentDate = new Date();
  return ((currentDate - modifiedDate) / (1000 * 60 * 60)) >= parseInt(HOURS_DELIVERING_TIMEOUT);
};

/**
 * convert a file url (share://the/path/to/the/file) to the local path
 * e.g `filePath/the/path/to/the/file`
 * @method fileUrlToPath
 * @return {String}
 */
const fileUrlToPath = function(fileUrl, folder) {
  return fileUrl.replace('share:\/\/', folder);
};

const normalizeFileName = function(filename) {
  return filename.replace(/[^a-zA-Z0-9\.-_]/gi, '');
};

const pathToFileUrl = function(path, folder) {
  return path.replace(folder, 'share://');
};

export { scheduleJob, runPipeline };
