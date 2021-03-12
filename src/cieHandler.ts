// Global import
import express from 'express';
import Boom from 'boom';
import Joi from 'joi';
import { ObjectID } from 'mongodb';

// costum import
import { log } from './logs';
import { getDbHandle } from './database';
import { dbName } from './data/fixtureData';
import { companySchema } from './data/joiSchema';

import {Company} from './data/types'

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
  db.collection(cie).find({ email: req.user.email }).toArray((err:Error, results:Company[]) => {
    if (err) { return log.warn({ fnct: 'View Database', error: err }, 'Prob in VIew DB'); }
    return res.json(results);
  });
});
cieHandler.use((req, res, next) => {
  if (req.user.email === 'demouser@example.com') {
    return res.json({ status: 'Demo user' });
  }
  return next();
});
cieHandler.post('/', (req, res, next) => {
  const cieData = req.body;
  if (!cieData || Object.keys(cieData).length === 0) { return next(Boom.badRequest('Missing data')); }
  cieData.email = req.user.email;
  try {
    Joi.assert(cieData, companySchema)
    db.collection(cie).save(cieData, (err:Error) => {
      if (err) return log.warn({ fnct: 'Push New Company', error: err }, 'Error in the POST');
      log.info({ fnct: 'Push company' }, 'saved to database');
      return res.json({ status: 'Saved to database' });
    })
  } catch (error) {
    next(Boom.badRequest('Wrong Data Structure', error))
  }
  

});
cieHandler.put('/', (req, res, next) => {
  const { _id } = req.body;
  if (!_id) { return next(Boom.badRequest('Missing data')); }
  const tmp = { ...req.body, _id: new ObjectID(_id), email: req.user.email };
  // I cannot use tmp because it complain about _id that it need to be a string.
  try {
    Joi.assert({ ...req.body, email: tmp.email }, companySchema)  
    db.collection(cie).findOneAndUpdate({ _id: new ObjectID(_id) }, { $set: tmp }, { upsert: false }, (err:Error) => {
      if (err) {
        log.warn({ fnct: 'Put Old Company', error: err }, 'Error in the POST');
        return next(Boom.teapot('DB cannot make coffee', err));
      }
      log.info({ fnct: 'Push company' }, 'saved to database');
      return res.json({ status: 'Saved to database' });
    })
  } catch (error) {
    next(Boom.badRequest('Wrong Data Structure', error))
  }
});
cieHandler.delete('/:id', (req, res) => {
  const { id } = req.params;
  return db.collection(cie).remove({ _id: new ObjectID(id) }, { w: 1 }, (err:Error, data:string[]) => {
    if (err) return log.warn({ fnct: 'Delete Company', error: err }, 'Error in the Delete');
    return res.json(data);
  });
});

cieHandler.delete('/', (req, res, next) => {
  if (process.env.NODE_ENV !== 'test') { return next(Boom.badRequest('Not in Test mode')); }
  return db.collection(cie).remove(null, null, (err:Error, data:string[]) => {
    if (err) return log.warn({ fnct: 'Delete Company', error: err }, 'Error in the Delete');
    return res.json(data);
  });
});

module.exports = router;
