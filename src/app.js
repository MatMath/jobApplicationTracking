// Generic libs
const express = require('express');
const bodyParser = require('body-parser');

// custom libs
const { log } = require('./logs');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

log.info({ fnct: 'App' }, 'Starting the App.js file');

module.exports = app;
