// Global import
const express = require('express');
const Boom = require('boom');

// custom import
import { log } from './logs';
import { getDbHandle } from './database';
import { dbName } from './data/fixture';

export const paramHandler = express.Router();
let db = getDbHandle();

let { job } = dbName;
// middleware that is specific to this router
paramHandler.use((req, res, next) => {
  db = (db === undefined) ? getDbHandle() : db;
  job = (process.env.DBJOBS) ? process.env.DBJOBS : job; // Variable name for testing the DB.
  log.info({ fnct: 'Analytic request' }, 'Request for some Analytic');
  next();
});

// TODO: Filter by userId.
paramHandler.get('/', (req, res, next) => {
  const websiteList = () => new Promise((resolve, reject) => {
    db.collection(job).distinct('website', (err, result) => {
      if (err) return reject(err);
      return resolve(result);
    });
  });
  const titleList = () => new Promise((resolve, reject) => {
    db.collection(job).distinct('title', (err, result) => {
      if (err) return reject(err);
      return resolve(result);
    });
  });
  Promise.all([websiteList(), titleList()])
    .then(result => res.json({ website: result[0], title: result[1] }))
    .catch(err => next(Boom.badRequest('Error Getting params', err)));
});
