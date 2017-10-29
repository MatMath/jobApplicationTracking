const { dbName } = require('./objectStructure');
const { getDbHandle } = require('./database');
const { log } = require('./logs');

const { userCollection } = dbName;
let db = getDbHandle();

const convertDataStructure = (user) => {
  // eslint-disable-next-line object-curly-newline
  const { provider, displayName, placesLived, language, email, gender } = user;
  // const tmp = {
  //   provider: 'google',
  //   displayName: 'Math Leg',
  //   placesLived: [ { value: 'Montreal, Qc, Canada', primary: true } ],
  //   language: 'en',
  //   email: 'my.email@gmail.com',
  //   gender: 'male'
  // }
  // eslint-disable-next-line object-curly-newline
  return { provider, displayName, placesLived, language, email, gender };
};

const writeUserToDB = (user) => {
  db = (db === undefined) ? getDbHandle() : db;
  return new Promise((resolve, reject) => {
    db.collection(userCollection).update({ email: user.email }, user, { upsert: true }, (err) => {
      if (err) {
        log.warn({ fnct: 'Push New User', error: err }, 'Error in the POST');
        return reject(err);
      }
      return resolve('Saved to database');
    });
  });
};

module.exports = {
  convertDataStructure,
  writeUserToDB,
};
