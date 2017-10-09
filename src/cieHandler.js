// Global import
const express = require('express');

// costum import
const { log } = require('./logs');
const { getDbHandle } = require('./database');
const { dbName } = require('./objectStructure');

const router = express.Router();
let db = getDbHandle();

let { cie } = dbName;
// middleware that is specific to this router
router.use((req, res, next) => {
  db = (db === undefined) ? getDbHandle() : db;
  cie = (process.env.DBCIE) ? process.env.DBCIE : cie; // Variable name for testing the DB.
  log.info({ fnct: 'Cie request', request: req }, 'Request for the Cie');
  next();
});

router.get('/', (req, res) => {
  db.collection(cie).find().toArray((err, results) => {
    if (err) { return log.warn({ fnct: 'View Database', error: err }, 'Prob in VIew DB'); }
    return res.json(results);
  });
});
router.post('/', (req, res) => {
  db.collection(cie).save(req.body, (err, result) => {
    if (err) return log.warn({ fnct: 'Push New company', error: err }, 'Error in the POST');
    log.info({ fnct: 'Push cie', data: result }, 'saved to database');
    return res.redirect('/');
  });
});
router.delete('/', (req, res) => {
  if (process.env.NODE_ENV !== 'test') { return res.redirect('/'); }
  db.collection(cie).remove(null, null, (err, data) => {
    if (err) return log.warn({ fnct: 'Push New company', error: err }, 'Error in the Delete');
    return res.json(data);
  });
});

module.exports = router;
