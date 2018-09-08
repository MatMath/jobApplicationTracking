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
  db.collection(job)
    .aggregate([
      {
        $match: {
          application: true,
          email: req.user.email,
        },
      },
      {
        $project: {
          item: '$website',
          answer_receive: {
            $cond: ['$answer_receive', 1, 0],
          },
        },
      },
      {
        $group: {
          _id: '$item',
          count: { $sum: 1 },
          answer_receive: { $sum: '$answer_receive' },
        },
      }])
    .toArray((err, docs) => res.json(docs));
});

router.get('/title', (req, res) => {
  db.collection(job)
    .aggregate([
      {
        $match: {
          application: true,
          email: req.user.email,
        },
      },
      {
        $group: {
          _id: '$title',
          count: { $sum: 1 },
        },
      }])
    .toArray((err, result) => res.json(result));
});

router.get('/successrate', (req, res) => {
  db.collection(job)
    .aggregate([
      {
        $match: {
          email: req.user.email,
        },
      },
      {
        $group: {
          _id: '$website',
          total: { $sum: 1 },
          success: {
            $sum: { $cond: ['$answer_receive', 1, 0] },
          },
        },
      }])
    .toArray((err, result) => res.json(result));
});

module.exports = router;
