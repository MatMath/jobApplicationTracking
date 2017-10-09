// Generic libs
const express = require('express');
const bodyParser = require('body-parser');

// custom libs
const { log, getBunyanLog } = require('./logs');
const { dBconnect } = require('./database');
const { globalStructure, meetingInfo, applicationType } = require('./objectStructure');

let jobapplication = 'jobapplication';
let company = 'company';
let recruiters = 'recruiters';

const initialize = () => {
  jobapplication = (process.env.DBJOBS) ? process.env.DBJOBS : jobapplication; // Variable name for testing the DB.
  company = (process.env.DBCIE) ? process.env.DBCIE : company; // Variable name for testing the DB.
  recruiters = (process.env.DBRECRU) ? process.env.DBRECRU : recruiters; // Variable name for testing the DB.
};

let db;
dBconnect().then((data) => {
  db = data;
}); // Async, but We should not expect a call at server bootup.
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

log.info({ fnct: 'App' }, 'Starting the App.js file');

// Get info
app.get('/log/all', (req, res) => res.json(getBunyanLog('all')));
app.get('/log', (req, res) => res.json(getBunyanLog('info')));
app.get('/basicparam', (req, res) => {
  res.json({ emptyObject: globalStructure, meetingInfo, applicationType });
});
app.get('/view', (req, res) => {
  db.collection(jobapplication).find().toArray((err, results) => {
    if (err) { return log.warn({ fnct: 'View Database', error: err }, 'Prob in VIew DB'); }
    return res.json(results);
  });
});
app.get('/cie', (req, res) => {
  db.collection(jobapplication).find().toArray((err, results) => {
    if (err) { return log.warn({ fnct: 'View Database', error: err }, 'Prob in VIew DB'); }
    return res.json(results);
  });
});
app.get('/recruiterslist', (req, res) => {
  db.collection(recruiters).find().toArray((err, results) => {
    if (err) { return log.warn({ fnct: 'View Database', error: err }, 'Prob in VIew DB'); }
    return res.json(results);
  });
});

// Add new info
app.post('/newapp', (req, res) => {
  db.collection(jobapplication).save(req.body, (err, result) => {
    if (err) return log.warn({ fnct: 'Push New Application', error: err }, 'Error in the POST');
    log.info({ fnct: 'Push Quote', data: result }, 'saved to database');
    return res.redirect('/');
  });
});
app.post('/newcie', (req, res) => {
  db.collection(company).save(req.body, (err, result) => {
    if (err) return log.warn({ fnct: 'Push New company', error: err }, 'Error in the POST');

    log.info({ fnct: 'Push cie', data: result }, 'saved to database');
    return res.redirect('/');
  });
});

// Update info

// Delete Info
app.post('/delete/list', (req, res) => {
  if (process.env.NODE_ENV !== test) { return res.redirect('/'); }
  db.collection(jobapplication).remove(null, null, (err, data) => {
    if (err) return log.warn({ fnct: 'Push New company', error: err }, 'Error in the Delete');
    return res.json(data);
  });
});
app.post('/delete/cie', (req, res) => {
  if (process.env.NODE_ENV !== test) { return res.redirect('/'); }
  db.collection(company).remove(null, null, (err, data) => {
    if (err) return log.warn({ fnct: 'Push New company', error: err }, 'Error in the Delete');
    return res.json(data);
  });
});
app.post('/delete/recruiters', (req, res) => {
  if (process.env.NODE_ENV !== test) { return res.redirect('/'); }
  db.collection(recruiters).remove(null, null, (err, data) => {
    if (err) return log.warn({ fnct: 'Push New company', error: err }, 'Error in the Delete');
    return res.json(data);
  });
});

app.get('/', (req, res) => {
  res.sendFile(`${__dirname}/index.html`);
});
app.initialize = initialize;

module.exports = app;
