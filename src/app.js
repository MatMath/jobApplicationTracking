// Generic libs
const express = require('express');
const bodyParser = require('body-parser');

// custom libs
const { log, getBunyanLog } = require('./logs');
const { dBconnect } = require('./database');

let db;
dBconnect().then((data) => {
  db = data;
}); // Async, but We should not expect a call at server bootup.
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

log.info({ fnct: 'App' }, 'Starting the App.js file');

app.get('/info', (req, res) => res.json(getBunyanLog('info')));
app.get('/all', (req, res) => res.json(getBunyanLog('all')));
app.post('/quotes', (req, res) => {
  db.collection('quotes').save(req.body, (err, result) => {
    if (err) return log.warn({ fnct: 'Push Quote', error: err }, 'Error in the POST');

    log.info({ fnct: 'Push Quote', data: result }, 'saved to database');
    return res.redirect('/');
  });
});
app.get('/view', (req, res) => {
  console.log('DATABASE: ', db);
  db.collection('quotes').find().toArray((err, results) => {
    if (err) { return log.warn({ fnct: 'View Database', error: err }, 'Prob in VIew DB'); }
    return res.json(results);
  });
});
app.get('/', (req, res) => {
  res.sendFile(`${__dirname}/index.html`);
});


module.exports = app;
