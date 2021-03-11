// Global import
import express from 'express';
import Boom from 'boom';
import Joi from 'joi';
import { ObjectID } from 'mongodb';

// custom import
import { log } from './logs';
import { getDbHandle } from './database';
import { dbName } from './data/fixtureData';
import { globalStructureSchema } from './data/joiSchema';

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
  db.collection(job).findOne({ _id: new ObjectID(id) }, (err, docs) => {
    if (err) { return log.warn({ fnct: 'View Database', error: err }, 'Prob in VIew DB'); }
    return res.json(docs);
  });
});

listHandler.get('/', (req, res) => {
  db.collection(job).find({ email: req.user.email }).toArray((err, results) => {
    if (err) { return log.warn({ fnct: 'View Database', error: err }, 'Prob in VIew DB'); }
    return res.json(results);
  });
});
listHandler.use((req, res, next) => {
  if (req.user.email === 'demouser@example.com') {
    return res.json({ status: 'Demo user' });
  }
  return next();
});
listHandler.post('/', (req, res, next) => {
  const bodyData = req.body;
  if (!bodyData || Object.keys(bodyData).length === 0) { return next(Boom.badRequest('Missing data')); }
  bodyData.email = req.user.email;
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
  const tmp = { ...req.body, _id: new ObjectID(_id), email: req.user.email };
  // I cannot use tmp because it complain about _id that it need to be a string.
  try {
    Joi.assert({ ...req.body, email: tmp.email }, globalStructureSchema)  
    db.collection(job).findOneAndUpdate({ _id: new ObjectID(_id) }, { $set: tmp }, { upsert: false }, (err) => {
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
  return db.collection(job).remove({ _id: new ObjectID(id) }, { w: 1 }, (err, data) => {
    if (err) return log.warn({ fnct: 'Delete Job', error: err }, 'Error in the Delete');
    return res.json(data);
  });
});

listHandler.delete('/', (req, res, next) => {
  if (process.env.NODE_ENV !== 'test') { return next(Boom.badRequest('Not in Test mode')); }
  return db.collection(job).remove(null, null, (err:Error, data:string[]) => {
    if (err) return log.warn({ fnct: 'Delete Job', error: err }, 'Error in the Delete');
    return res.json(data);
  });
});
