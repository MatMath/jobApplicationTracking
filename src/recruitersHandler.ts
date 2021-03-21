// Global import
const express = require('express');
const Boom = require('boom');
const Joi = require('joi');
const { ObjectID } = require('mongodb');

// custom import
import { log } from './logs';
import { getDbHandle } from './database';
import { recruitersInfoSchema } from './data/joiStructure';
import { dbName } from './data/fixture';


export const recruitersHandler = express.Router();
let db = getDbHandle();

let { recruiters } = dbName;
// middleware that is specific to this router
recruitersHandler.use((req, res, next) => {
  db = (db === undefined) ? getDbHandle() : db;
  recruiters = (process.env.DBRECRU) ? process.env.DBRECRU : recruiters; // Variable name for testing the DB.
  log.info({ fnct: 'Job request' }, 'Request for the Job');
  next();
});

recruitersHandler.get('/', (req, res) => {
  db.collection(recruiters).find({ email: req.user.email }).toArray((err, results) => {
    if (err) { return log.warn({ fnct: 'View Database', error: err }, 'Prob in VIew DB'); }
    return res.json(results);
  });
});
recruitersHandler.use((req, res, next) => {
  if (req.user.email === 'demouser@example.com') {
    return res.json({ status: 'Demo user' });
  }
  return next();
});
recruitersHandler.post('/', (req, res, next) => {
  const bodyData = req.body;
  if (!bodyData || Object.keys(bodyData).length === 0) { return next(Boom.badRequest('Missing data')); }
  bodyData.email = req.user.email;
  try {
    Joi.assert(bodyData, recruitersInfoSchema)
    db.collection(recruiters).save(bodyData, (err) => {
      if (err) return log.warn({ fnct: 'Push New Recruiters', error: err }, 'Error in the POST');
      log.info({ fnct: 'Push recruiters' }, 'saved to database');
      return res.json({ status: 'Saved to database' });
    })
  } catch (error) {
    next(Boom.badRequest('Wrong Data Structure', error))
  }
});
recruitersHandler.put('/', (req, res, next) => {
  const { _id } = req.body;
  if (!_id) { return next(Boom.badRequest('Missing ID data')); }
  const tmp = { ...req.body, _id: ObjectID(_id), email: req.user.email };
  // I cannot use tmp because it complain about _id that it need to be a string.
  try {
    Joi.assert({ ...req.body, email: tmp.email }, recruitersInfoSchema)
    db.collection(recruiters).findOneAndUpdate({ _id: ObjectID(_id) }, { $set: tmp }, { upsert: false }, (err) => {
      if (err) {
        log.warn({ fnct: 'Put Old Recruiters', error: err }, 'Error in the POST');
        return next(Boom.teapot('DB cannot make coffee', err));
      }
      log.info({ fnct: 'Push recruiters' }, 'saved to database');
      return res.json({ status: 'Saved to database' });
    })
  } catch (error) {
    return next(Boom.badRequest('Wrong Data Structure', error))
  }
});
recruitersHandler.delete('/:id', (req, res) => {
  const { id } = req.params;
  return db.collection(recruiters).remove({ _id: ObjectID(id) }, { w: 1 }, (err, data) => {
    if (err) return log.warn({ fnct: 'Delete Recruiters', error: err }, 'Error in the Delete');
    return res.json(data);
  });
});
recruitersHandler.delete('/', (req, res, next) => {
  if (process.env.NODE_ENV !== 'test') { return next(Boom.badRequest('Not in Test mode')); }
  return db.collection(recruiters).remove(null, null, (err, data) => {
    if (err) return log.warn({ fnct: 'Delete Recruiters', error: err }, 'Error in the Delete');
    return res.json(data);
  });
});
