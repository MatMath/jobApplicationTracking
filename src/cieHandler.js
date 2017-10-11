// Global import
const express = require('express');
const Boom = require('boom');
const Joi = require('joi');
const { ObjectID } = require('mongodb');

// costum import
const { log } = require('./logs');
const { getDbHandle } = require('./database');
const { dbName, companySchema } = require('./objectStructure');

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
router.post('/', (req, res, next) => {
  if (!req.body) { next(Boom.badRequest('Missing data')); }
  Joi.validate(req.body, companySchema)
    .then(() => db.collection(cie).save(req.body, (err) => {
      if (err) return log.warn({ fnct: 'Push New Company', error: err }, 'Error in the POST');
      log.info({ fnct: 'Push company' }, 'saved to database');
      return res.redirect('/');
    }))
    .catch(err => next(Boom.badRequest('Wrong Data Structure', err)));
});
router.put('/', (req, res, next) => {
  const { id, data } = req.body;
  if (!id || !data) { next(Boom.badRequest('Missing data')); }
  Joi.validate(data, companySchema)
    .then(() => db.collection(cie).findOneAndUpdate({ _id: ObjectID(id) }, req.body.data, (err) => {
      if (err) {
        log.warn({ fnct: 'Put Old Company', error: err }, 'Error in the POST');
        return next(Boom.teapot('DB cannot make coffee', err));
      }
      log.info({ fnct: 'Push company' }, 'saved to database');
      return res.redirect('/');
    }))
    .catch(err => next(Boom.badRequest('Wrong Data Structure', err)));
});
router.delete('/', (req, res, next) => {
  if (req.body.id) {
    db.collection(cie).remove({ _id: ObjectID(req.body.id) }, { w: 1 }, (err, data) => {
      if (err) return log.warn({ fnct: 'Delete Company', error: err }, 'Error in the Delete');
      return res.json(data);
    });
  } else {
    if (process.env.NODE_ENV !== 'test' && !req.body.id) { next(Boom.badRequest('Missing ID')); }
    db.collection(cie).remove(null, null, (err, data) => {
      if (err) return log.warn({ fnct: 'Delete Company', error: err }, 'Error in the Delete');
      return res.json(data);
    });
  }
});

module.exports = router;
