// Generic libs
const express = require('express');
const bodyParser = require('body-parser');

// custom libs
const { log, getBunyanLog } = require('./logs');
const { dBconnect, handleDatabaseError } = require('./database');
const { routeNotFound, genericErrorHandling } = require('./errorHandling');
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

// Catch if no route match.
app.use(routeNotFound);

// Error handler section
app.use(handleDatabaseError);
app.use(genericErrorHandling);

app.dBconnect = dBconnect;

module.exports = app;
