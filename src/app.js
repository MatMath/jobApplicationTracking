const { MongoClient } = require('mongodb');
const config = require('../config.json');

const uri = config.mongourl;
MongoClient.connect(uri, (err, db) => {
  if (err) return console.log(err)
   db = database
   app.listen(3000, () => {
     console.log('listening on 3000')
   })
  db.close();
});
