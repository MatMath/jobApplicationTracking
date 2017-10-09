// Global import
const express = require('express');

// costum import
const { log } = require('./logs');
const { getDbHandle } = require('./database');
const { dbName } = require('./objectStructure');

const router = express.Router();
let db = getDbHandle();

let { job } = dbName;
// middleware that is specific to this router
router.use((req, res, next) => {
  db = (db === undefined) ? getDbHandle() : db;
  job = (process.env.DBJOBS) ? process.env.DBJOBS : job; // Variable name for testing the DB.
  log.info({ fnct: 'Job request', request: req }, 'Request for the Job');
  next();
});

router.get('/', (req, res) => {
  db.collection(job).find().toArray((err, results) => {
    if (err) { return log.warn({ fnct: 'View Database', error: err }, 'Prob in VIew DB'); }
    return res.json(results);
  });
});

router.post('/', (req, res) => {
  db.collection(job).save(req.body, (err, result) => {
    if (err) return log.warn({ fnct: 'Push New Application', error: err }, 'Error in the POST');
    log.info({ fnct: 'Push Quote', data: result }, 'saved to database');
    return res.redirect('/');
  });
});

router.delete('/', (req, res) => {
  if (process.env.NODE_ENV !== 'test') { return res.redirect('/'); }
  db.collection(job).remove(null, null, (err, data) => {
    if (err) return log.warn({ fnct: 'Push New company', error: err }, 'Error in the Delete');
    return res.json(data);
  });
});

module.exports = router;
