// Global import
const express = require('express');

// costum import
const { log } = require('./logs');
const { getDbHandle } = require('./database');
const { dbName } = require('./objectStructure');

const router = express.Router();
let db = getDbHandle();

let { recruiters } = dbName;
// middleware that is specific to this router
router.use((req, res, next) => {
  db = (db === undefined) ? getDbHandle() : db;
  recruiters = (process.env.DBRECRU) ? process.env.DBRECRU : recruiters; // Variable name for testing the DB.
  log.info({ fnct: 'Job request', request: req }, 'Request for the Job');
  next();
});

router.get('/', (req, res) => {
  db.collection(recruiters).find().toArray((err, results) => {
    if (err) { return log.warn({ fnct: 'View Database', error: err }, 'Prob in VIew DB'); }
    return res.json(results);
  });
});

router.delete('/', (req, res) => {
  if (process.env.NODE_ENV !== 'test') { return res.redirect('/'); }
  db.collection(recruiters).remove(null, null, (err, data) => {
    if (err) return log.warn({ fnct: 'Push New company', error: err }, 'Error in the Delete');
    return res.json(data);
  });
});

module.exports = router;
