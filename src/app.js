// Generic libs
const express = require('express');
const bodyParser = require('body-parser');

// custom libs
const { log, getBunyanLog } = require('./logs');
const { dBconnect, getDbHandle } = require('./database');
const {
  globalStructure,
  meetingInfo,
  applicationType,
  dbName,
} = require('./objectStructure');

// Routing
const cieHandler = require('./cieHandler');

let { job, cie, recruiters } = dbName;
let db;

const initialize = () => {
  job = (process.env.DBJOBS) ? process.env.DBJOBS : job; // Variable name for testing the DB.
  cie = (process.env.DBCIE) ? process.env.DBCIE : cie; // Variable name for testing the DB.
  recruiters = (process.env.DBRECRU) ? process.env.DBRECRU : recruiters; // Variable name for testing the DB.
  db = getDbHandle(); // Is Async on bootup, but We should not expect a call at server bootup.
};

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

log.info({ fnct: 'App' }, 'Starting the App.js file');

// Get info
app.get('/log/all', (req, res) => res.json(getBunyanLog('all')));
app.get('/log', (req, res) => res.json(getBunyanLog('info')));
app.get('/basicparam', (req, res) => {
  res.json({ emptyObject: globalStructure, meetingInfo, applicationType });
});
app.use('/cie', cieHandler);
app.get('/view', (req, res) => {
  db.collection(job).find().toArray((err, results) => {
    if (err) { return log.warn({ fnct: 'View Database', error: err }, 'Prob in VIew DB'); }
    return res.json(results);
  });
});

app.get('/recruiters', (req, res) => {
  db.collection(recruiters).find().toArray((err, results) => {
    if (err) { return log.warn({ fnct: 'View Database', error: err }, 'Prob in VIew DB'); }
    return res.json(results);
  });
});

// Add new info
app.post('/newapp', (req, res) => {
  db.collection(job).save(req.body, (err, result) => {
    if (err) return log.warn({ fnct: 'Push New Application', error: err }, 'Error in the POST');
    log.info({ fnct: 'Push Quote', data: result }, 'saved to database');
    return res.redirect('/');
  });
});
app.post('/newcie', (req, res) => {
  db.collection(cie).save(req.body, (err, result) => {
    if (err) return log.warn({ fnct: 'Push New company', error: err }, 'Error in the POST');

    log.info({ fnct: 'Push cie', data: result }, 'saved to database');
    return res.redirect('/');
  });
});

// Update info

// Delete Info
app.post('/delete/list', (req, res) => {
  if (process.env.NODE_ENV !== 'test') { return res.redirect('/'); }
  db.collection(job).remove(null, null, (err, data) => {
    if (err) return log.warn({ fnct: 'Push New company', error: err }, 'Error in the Delete');
    return res.json(data);
  });
});
app.post('/delete/cie', (req, res) => {
  if (process.env.NODE_ENV !== 'test') { return res.redirect('/'); }
  db.collection(cie).remove(null, null, (err, data) => {
    if (err) return log.warn({ fnct: 'Push New company', error: err }, 'Error in the Delete');
    return res.json(data);
  });
});
app.post('/delete/recruiters', (req, res) => {
  if (process.env.NODE_ENV !== 'test') { return res.redirect('/'); }
  db.collection(recruiters).remove(null, null, (err, data) => {
    if (err) return log.warn({ fnct: 'Push New company', error: err }, 'Error in the Delete');
    return res.json(data);
  });
});

app.get('/', (req, res) => {
  res.sendFile(`${__dirname}/index.html`);
});
app.initialize = initialize;
app.dBconnect = dBconnect;

initialize(); // Need to be re-initialisez for test coverage (DB name change);
module.exports = app;
