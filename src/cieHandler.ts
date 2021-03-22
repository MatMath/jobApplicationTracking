// Global import
const express = require('express');
const Boom = require('boom');
const Joi = require('joi');
const { ObjectID } = require('mongodb');

// custom import
const { log } = require('./logs');
const { getDbHandle } = require('./database');
const { companySchema } = require('./data/joiStructure');
import { dbName } from './data/fixture';

export const cieHandler = express.Router();
let db = getDbHandle();

let { cie } = dbName;
// middleware that is specific to this router
cieHandler.use((req, res, next) => {
  db = (db === undefined) ? getDbHandle() : db;
  cie = (process.env.DBCIE) ? process.env.DBCIE : cie; // Variable name for testing the DB.
  log.info({ fnct: 'Cie request' }, 'Request for the Cie');
  next();
});

cieHandler.get('/', (req, res) => {
  db.collection(cie).find({ userId: req.user.userId }).toArray((err, results) => {
    if (err) { return log.warn({ fnct: 'View Database', error: err }, 'Prob in VIew DB'); }
    return res.json(results);
  });
});
cieHandler.use((req, res, next) => {
  if (req.user.userId === 'demouser@example.com') {
    return res.json({ status: 'Demo user' });
  }
  return next();
});
cieHandler.post('/', (req, res, next) => {
  const cieData = req.body;
  if (!cieData || Object.keys(cieData).length === 0) { return next(Boom.badRequest('Missing data')); }
  cieData.userId = req.user.userId;
  try {
    Joi.assert(cieData, companySchema)
    console.log('JOI asserted');
    db.collection(cie).save(cieData, (err) => {
      if (err) return log.warn({ fnct: 'Push New Company', error: err }, 'Error in the POST');
      log.info({ fnct: 'Push company' }, 'saved to database');
      return res.json({ status: 'Saved to database' });
    });
  } catch (error) {
   next(Boom.badRequest('Wrong Data Structure', error)) 
  }
});
cieHandler.put('/', (req, res, next) => {
  const { _id } = req.body;
  if (!_id) { return next(Boom.badRequest('Missing data')); }
  const tmp = { ...req.body, _id: ObjectID(_id), userId: req.user.userId };
  // I cannot use tmp because it complain about _id that it need to be a string.
  try {
    Joi.assert({ ...req.body, userId: tmp.userId }, companySchema)
    db.collection(cie).findOneAndUpdate({ _id: ObjectID(_id) }, { $set: tmp }, { upsert: false }, (err) => {
      if (err) {
        log.warn({ fnct: 'Put Old Company', error: err }, 'Error in the POST');
        return next(Boom.teapot('DB cannot make coffee', err));
      }
      log.info({ fnct: 'Push company' }, 'saved to database');
      return res.json({ status: 'Saved to database' });
    })
  } catch (error) {
    next(Boom.badRequest('Wrong Data Structure', error));
  }
});
cieHandler.delete('/:id', (req, res) => {
  const { id } = req.params;
  return db.collection(cie).remove({ _id: ObjectID(id) }, { w: 1 }, (err, data) => {
    if (err) return log.warn({ fnct: 'Delete Company', error: err }, 'Error in the Delete');
    return res.json(data);
  });
});

cieHandler.delete('/', (req, res, next) => {
  if (process.env.NODE_ENV !== 'test') { return next(Boom.badRequest('Not in Test mode')); }
  return db.collection(cie).remove(null, null, (err, data) => {
    if (err) return log.warn({ fnct: 'Delete Company', error: err }, 'Error in the Delete');
    return res.json(data);
  });
});
