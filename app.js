import { app } from 'mu';
import bodyParser from 'body-parser';
import { CronJob } from 'cron';
import { uuid, sparqlEscapeString, sparqlEscapeDateTime, sparqlEscapeUri } from 'mu';
import { scheduleJob, runPipeline } from './support';

const cronFrequency = process.env.PACKAGE_CRON_PATTERN || '*/10 * * * * *';

// To make our live easy, let's use application/json
app.use(bodyParser.json());

createCronJob();
function createCronJob() {
  return new CronJob(cronFrequency, function() {
    console.log(`Pipeline triggered by cron job at ${new Date().toISOString()}`);
    runPipeline();
  }, null, true);
}

app.post('/simple-file-package-jobs', async function(req, res, next ) {
  try {
    let jobUri = await scheduleJob(req.body);
    return res.status(202).send({status:202, job: { uri: jobUri } });
  }
  catch(e) {
    return next(new Error(e.message));
  }
});

app.post('/simple-file-package-pipeline', async function(req, res){
  runPipeline();
  return res.status(202).send({ status:202 });
});
