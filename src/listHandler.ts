// Global import
const express = require('express');
const Boom = require('boom');
const Joi = require('joi');
const { ObjectID } = require('mongodb');

// custom import
import { log } from './logs';
import { getDbHandle } from './database';
import { globalStructureSchema } from './data/joiStructure';
import { dbName } from './data/fixture';

export const listHandler = express.Router();
let db = getDbHandle();

let { job } = dbName;
// middleware that is specific to this router
listHandler.use((req, res, next) => {
  db = (db === undefined) ? getDbHandle() : db;
  job = (process.env.DBJOBS) ? process.env.DBJOBS : job; // Variable name for testing the DB.
  log.info({ fnct: 'Job request' }, 'Request for the Job');
  next();
});

listHandler.get('/:id', (req, res) => {
  const { id } = req.params;
  db.collection(job).findOne({ _id: ObjectID(id) }, (err, docs) => {
    if (err) { return log.warn({ fnct: 'View Database', error: err }, 'Prob in VIew DB'); }
    return res.json(docs);
  });
});

listHandler.get('/', (req, res) => {
  db.collection(job).find({ userId: req.user.userId }).toArray((err, results) => {
    if (err) { return log.warn({ fnct: 'View Database', error: err }, 'Prob in VIew DB'); }
    return res.json(results);
  });
});
listHandler.use((req, res, next) => {
  if (req.user.userId === 'demouser@example.com') {
    return res.json({ status: 'Demo user' });
  }
  return next();
});
listHandler.post('/', (req, res, next) => {
  const bodyData = req.body;
  if (!bodyData || Object.keys(bodyData).length === 0) { return next(Boom.badRequest('Missing data')); }
  bodyData.userId = req.user.userId;
  try {
    Joi.assert(bodyData, globalStructureSchema)
    db.collection(job).save(bodyData, (err) => {
      if (err) return log.warn({ fnct: 'Push New Job', error: err }, 'Error in the POST');
      log.info({ fnct: 'Push recruiters' }, 'saved to database');
      return res.json({ status: 'Saved to database' });
    })
  } catch (error) {
    next(Boom.badRequest('Wrong Data Structure', error))
  }
});

listHandler.put('/', (req, res, next) => {
  const { _id } = req.body;
  if (!_id) { return next(Boom.badRequest('Missing data')); }
  const tmp = { ...req.body, _id: ObjectID(_id), userId: req.user.userId };
  // I cannot use tmp because it complain about _id that it need to be a string.
  try {
    Joi.assert({ ...req.body, userId: tmp.userId }, globalStructureSchema)
    db.collection(job).findOneAndUpdate({ _id: ObjectID(_id) }, { $set: tmp }, { upsert: false }, (err) => {
      if (err) {
        log.warn({ fnct: 'Put Old Job', error: err }, 'Error in the POST');
        return next(Boom.teapot('DB cannot make coffee', err));
      }
      log.info({ fnct: 'Push recruiters' }, 'saved to database');
      return res.json({ status: 'Saved to database' });
    })
  } catch (error) {
    next(Boom.badRequest('Wrong Data Structure', error))
  }
});

listHandler.delete('/:id', (req, res) => {
  const { id } = req.params;
  return db.collection(job).remove({ _id: ObjectID(id) }, { w: 1 }, (err, data) => {
    if (err) return log.warn({ fnct: 'Delete Job', error: err }, 'Error in the Delete');
    return res.json(data);
  });
});

listHandler.delete('/', (req, res, next) => {
  if (process.env.NODE_ENV !== 'test') { return next(Boom.badRequest('Not in Test mode')); }
  return db.collection(job).remove(null, null, (err, data) => {
    if (err) return log.warn({ fnct: 'Delete Job', error: err }, 'Error in the Delete');
    return res.json(data);
  });
});