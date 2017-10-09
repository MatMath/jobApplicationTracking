// Generic libs
const express = require('express');
const bodyParser = require('body-parser');

// custom libs
const { log, getBunyanLog } = require('./logs');
const { dBconnect, handleDatabaseError } = require('./database');
const {
  globalStructure,
  meetingInfo,
  applicationType,
} = require('./objectStructure');

// Routing
const cieHandler = require('./cieHandler');
const listHandler = require('./listHandler');
const recruitersHandler = require('./recruitersHandler');

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
app.use('/list', listHandler);
app.use('/recruiters', recruitersHandler);

app.get('/', (req, res) => {
  res.sendFile(`${__dirname}/index.html`);
});

app.use(handleDatabaseError);
app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use((err, req, res) => {
  res.status(err.status || 500);
  res.json({
    message: err.message,
    error: {},
    title: 'error',
  });
});

app.dBconnect = dBconnect;

module.exports = app;
