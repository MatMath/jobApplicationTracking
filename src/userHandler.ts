import { dbName } from './data/fixture';
import { getDbHandle } from './database';
import { log } from './logs';
import { UserDetails } from './data/types'

const { userCollection } = dbName;
let db = getDbHandle();

export const convertDataStructure = (user): UserDetails => {
  // eslint-disable-next-line object-curly-newline
  const { id:userId, displayName } = user;
  // eslint-disable-next-line object-curly-newline
  return { userId, displayName };
};

export const writeUserToDB = (user: UserDetails):Promise<void> => {
  db = (db === undefined) ? getDbHandle() : db;
  return new Promise((resolve, reject) => {
    db.collection(userCollection).update({ userId: user.userId }, user, { upsert: true }, (err) => {
      if (err) {
        log.warn({ fnct: 'Push New User', error: err }, 'Error in the POST');
        return reject(err);
      }
      return resolve();
    });
  });
};
