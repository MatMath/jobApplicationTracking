// Global import
const express = require('express');
// const Boom = require('boom');
// const Joi = require('joi');
// const { ObjectID } = require('mongodb');

// costum import
const { log } = require('./logs');
const { getDbHandle } = require('./database');
const { dbName } = require('./objectStructure');

const router = express.Router();
let db = getDbHandle();

let { recruiters, job, cie } = dbName;
// middleware that is specific to this router
router.use((req, res, next) => {
  db = (db === undefined) ? getDbHandle() : db;
  recruiters = (process.env.DBRECRU) ? process.env.DBRECRU : recruiters; // Variable name for testing the DB.
  job = (process.env.DBJOBS) ? process.env.DBJOBS : job; // Variable name for testing the DB.
  cie = (process.env.DBCIE) ? process.env.DBCIE : cie; // Variable name for testing the DB.
  log.info({ fnct: 'Analytic request' }, 'Request for some Analytic');
  next();
});

router.get('/website', (req, res) => {
  db.collection(job).aggregate([{
    $group: {
      _id: '$website',
      count: { $sum: 1 },
    },
  }], (err, result) => {
    console.log(result, err);
    res.json(result);
  });
});

module.exports = router;
