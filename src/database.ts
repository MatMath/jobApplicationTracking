// Generic
import { MongoClient, MongoError } from 'mongodb';

// Custom
import { mongourl, mongoDBName } from '../config.js';
import { log } from './logs';

let dbName;

export const dBconnect = async () => {
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

export const handleDatabaseError = (error, req, res, next) => {
  if (error instanceof MongoError) {
    return res.status(503).json({
      type: 'MongoError',
      message: error.message,
    });
  }
  return next(error);
};

export const getDbHandle = () => dbName;

module.exports = {
  dBconnect,
  getDbHandle: () => dbName,
  handleDatabaseError,
};