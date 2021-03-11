// Global import
import express, {Request, Response} from 'express';
import Boom from 'boom';
import * as Joi from 'joi';
import { ObjectID } from 'mongodb';

// custom import
import { log } from '../logs';
import { getDbHandle } from '../database';
import { dbName } from '../data/fixtureData';
import { RecruitersInfo } from '../data/types';
import { recruitersInfoSchema } from '../data/joiSchema';

export const recruitersHandler = express.Router();
let db = getDbHandle();

let { recruiters } = dbName;

// https://stackoverflow.com/questions/54030381/unable-to-extend-express-request-in-typescript/54657418
// Revisit to make more precice.
declare global {
  namespace Express {
      export interface Request {
          user: {
            email: string,
          };
      }
  }
}

recruitersHandler.use((req, res, next) => {
  db = (db === undefined) ? getDbHandle() : db;
  recruiters = (process.env.DBRECRU) ? process.env.DBRECRU : recruiters; // Variable name for testing the DB.
  log.info({ fnct: 'Job request' }, 'Request for the Job');
  next();
});

recruitersHandler.get('/', (req:Request, res:Response) => {
  db.collection(recruiters).find({ email: req.user.email }).toArray((err:Error, results: RecruitersInfo[]) => {
    if (err) { return log.warn({ fnct: 'View Database', error: err }, 'Prob in VIew DB'); }
    return res.json(results);
  });
});
recruitersHandler.use((req:Request, res:Response, next) => {
  if (req.user.email === 'demouser@example.com') {
    return res.json({ status: 'Demo user' });
  }
  return next();
});
recruitersHandler.post('/', (req:Request, res:Response, next) => {
  const bodyData = req.body as RecruitersInfo;
  if (!bodyData || Object.keys(bodyData).length === 0) { return next(Boom.badRequest('Missing data')); }
  bodyData.email = req.user.email;
  try {
    Joi.assert(bodyData, recruitersInfoSchema)
    return db.collection(recruiters).save(bodyData, (err:Error) => {
      if (err) return log.warn({ fnct: 'Push New Recruiters', error: err }, 'Error in the POST');
      log.info({ fnct: 'Push recruiters' }, 'saved to database');
      return res.json({ status: 'Saved to database' });
    })
  } catch (error) {
    next(Boom.badRequest('Wrong Data Structure', error))
  } 
});
recruitersHandler.put('/', (req:Request, res:Response, next) => {
  const { _id } = req.body;
  if (!_id) { return next(Boom.badRequest('Missing ID data')); }
  const tmp = { ...req.body, _id: new ObjectID(_id), email: req.user.email };
  // I cannot use tmp because it complain about _id that it need to be a string.
  try {
    Joi.assert({ ...req.body, email: tmp.email }, recruitersInfoSchema)
    return db.collection(recruiters).findOneAndUpdate({ _id: new ObjectID(_id) }, { $set: tmp }, { upsert: false }, (err:Error) => {
      if (err) {
        log.warn({ fnct: 'Put Old Recruiters', error: err }, 'Error in the POST');
        return next(Boom.teapot('DB cannot make coffee', err));
      }
      log.info({ fnct: 'Push recruiters' }, 'saved to database');
      return res.json({ status: 'Saved to database' });
    })
  } catch (error) {
    next(Boom.badRequest('Wrong Data Structure', error))
  }
    
});
recruitersHandler.delete('/:id', (req:Request, res:Response) => {
  const { id } = req.params;
  return db.collection(recruiters).remove({ _id: new ObjectID(id) }, { w: 1 }, (err:Error, data:string[]) => {
    if (err) return log.warn({ fnct: 'Delete Recruiters', error: err }, 'Error in the Delete');
    return res.json(data);
  });
});

recruitersHandler.delete('/', (req:Request, res:Response, next) => {
  if (process.env.NODE_ENV !== 'test') { return next(Boom.badRequest('Not in Test mode')); }
  return db.collection(recruiters).remove(null, null, (err:Error, data:string[]) => {
    if (err) return log.warn({ fnct: 'Delete Recruiters', error: err }, 'Error in the Delete');
    return res.json(data);
  });
});
