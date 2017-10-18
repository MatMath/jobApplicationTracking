// Global import
const express = require('express');
const Boom = require('boom');
const Joi = require('joi');
const { ObjectID } = require('mongodb');

// costum import
const { log } = require('./logs');
const { getDbHandle } = require('./database');
const { dbName, globalStructureSchema } = require('./objectStructure');

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

router.post('/', (req, res, next) => {
  if (!req.body || Object.keys(req.body).length === 0) { return next(Boom.badRequest('Missing data')); }
  return Joi.validate(req.body, globalStructureSchema)
    .then(() => db.collection(job).save(req.body, (err) => {
      if (err) return log.warn({ fnct: 'Push New Job', error: err }, 'Error in the POST');
      log.info({ fnct: 'Push recruiters' }, 'saved to database');
      return res.json({ status: 'Saved to database' });
    }))
    .catch(err => next(Boom.badRequest('Wrong Data Structure', err)));
});

router.put('/', (req, res, next) => {
  const { id, data } = req.body;
  if (!id || !data) { return next(Boom.badRequest('Missing data')); }
  return Joi.validate(data, globalStructureSchema)
    .then(() => db.collection(job).findOneAndUpdate({ _id: ObjectID(id) }, data, (err) => {
      if (err) {
        log.warn({ fnct: 'Put Old Job', error: err }, 'Error in the POST');
        return next(Boom.teapot('DB cannot make coffee', err));
      }
      log.info({ fnct: 'Push recruiters' }, 'saved to database');
      return res.json({ status: 'Saved to database' });
    }))
    .catch(err => next(Boom.badRequest('Wrong Data Structure', err)));
});

router.delete('/', (req, res, next) => {
  if (req.body.id) {
    return db.collection(job).remove({ _id: ObjectID(req.body.id) }, { w: 1 }, (err, data) => {
      if (err) return log.warn({ fnct: 'Delete Job', error: err }, 'Error in the Delete');
      return res.json(data);
    });
  }
  if (process.env.NODE_ENV !== 'test' && !req.body.id) { return next(Boom.badRequest('Missing ID')); }
  return db.collection(job).remove(null, null, (err, data) => {
    if (err) return log.warn({ fnct: 'Delete Job', error: err }, 'Error in the Delete');
    return res.json(data);
  });
});

module.exports = router;
