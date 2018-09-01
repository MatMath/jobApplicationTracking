// Generic libs
const { MongoClient, MongoError } = require('mongodb');

// Custom fnct
const config = require('../config.json');
const { log } = require('./logs');

const { mongourl, mongoDBName } = config;
let dbName;

const dBconnect = () => new Promise((resolve, reject) => {
  MongoClient.connect(mongourl, (error, databaseHandle) => {
    if (error) {
      log.warn({ fnct: 'MongoClient', error }, 'Err Connecting to Mongo');
      reject(process.exit(1));
    }
    dbName = databaseHandle.db(mongoDBName);
    resolve(dbName);
  });
});

const handleDatabaseError = (error, req, res, next) => {
  if (error instanceof MongoError) {
    return res.status(503).json({
      type: 'MongoError',
      message: error.message,
    });
  }
  return next(error);
};

module.exports = {
  dBconnect,
  handleDatabaseError,
  getDbHandle: () => dbName,
};
