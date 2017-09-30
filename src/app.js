// Generic libs
const express = require('express');
const bodyParser = require('body-parser');

// custom libs
const { log, getBunyanLog } = require('./logs');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

log.info({ fnct: 'App' }, 'Starting the App.js file');

app.get('/info', (req, res) => res.json(getBunyanLog('info')));
app.get('/all', (req, res) => res.json(getBunyanLog('all')));
app.get('/', (req, res) => {
  res.json(['/info', '/all']);
});

module.exports = app;
