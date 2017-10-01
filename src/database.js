// Generic libs
const { MongoClient } = require('mongodb');

// Custom fnct
const config = require('../config.json');
const { log } = require('./logs');

const uri = config.mongourl;

const dBconnect = () => new Promise((resolve, reject) => {
  MongoClient.connect(uri, (error, databaseHandle) => {
    if (error) {
      log.warn({ fnct: 'MongoClient', error }, 'Err Connecting to Mongo');
      reject(process.exit(1));
    }
    resolve(databaseHandle);
  });
});

module.exports.dBconnect = dBconnect;
