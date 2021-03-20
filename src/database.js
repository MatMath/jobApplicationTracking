// Generic
const { MongoClient, MongoError } = require('mongodb');

// Custom
const { mongourl, mongoDBName } = require('../config.js');
const { log } = require('./logs');

let dbName;

const dBconnect = async () => {
  let client;
  try {
    client = await MongoClient.connect(mongourl, { useNewUrlParser: true, useUnifiedTopology: false });
    dbName = client.db(mongoDBName);
    return dbName;
  } catch (error) {
    log.warn({ fnct: 'MongoClient', error }, 'Err Connecting to Mongo');
    return process.exit(1);
  }
};

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
