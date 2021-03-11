import { dbName } from './data/fixtureData';
import { User } from './data/types';
import { getDbHandle } from './database';
import { log } from './logs';

const { userCollection } = dbName;
let db = getDbHandle();

export const convertDataStructure = (user: User): User => {
  // eslint-disable-next-line object-curly-newline
  const { provider, displayName, email, gender } = user;
  // eslint-disable-next-line object-curly-newline
  return { provider, displayName, email, gender };
};

export const writeUserToDB = (user: User) => {
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
