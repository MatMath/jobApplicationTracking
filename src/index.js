// Generic libs
const { MongoClient } = require('mongodb');

// Custom fnct
const config = require('../config.json');
const { log } = require('./logs');

const app = require('./app');

const uri = config.mongourl;
MongoClient.connect(uri, (error, db) => {
  if (error) {
    log.warn({ fnct: 'MongoClient', error }, 'Err Connecting to Mongo');
  } else {
    app.listen(3000, () => {
      log.info({ fnct: 'MongoClient' }, 'listening on 3000');
    });
    db.close();
  }
});
