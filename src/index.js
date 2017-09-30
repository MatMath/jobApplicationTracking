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
    app.set('port', process.env.API_PORT || 3001);
    const server = app.listen(app.get('port'), () => {
      console.log(`Express server listening on port ${server.address().port}`);
    });
    db.close();
  }
});
