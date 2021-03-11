// Generic libs
import { MongoClient, MongoError, Db } from 'mongodb';
import { Request, Response, NextFunction } from 'express';

// Custom function
import { mongourl, mongoDBName } from '../config.js';
import { log } from './logs';

let dbName: Db;

export const dBconnect = async (): Promise<Db> => {
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

export const handleDatabaseError = (error: Error, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof MongoError) {
    return res.status(503).json({
      type: 'MongoError',
      message: error.message,
    });
  }
  return next(error);
};

export const getDbHandle = (): Db => dbName
