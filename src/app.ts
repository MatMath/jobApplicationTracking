// Generic libs
import express, {Request, Response, NextFunction} from 'express';
import path from 'path';
import bodyParser from 'body-parser';
import cors from 'cors';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth2';
import cookieParser from 'cookie-parser';
// Tmp until I understand and then store it in Mongo Directly
import session from 'express-session';

import { User } from './data/types';
// custom libs
import { log, getBunyanLog } from './logs';
import { dBconnect, handleDatabaseError } from './database';
import { routeNotFound, genericErrorHandling } from './errorHandling';
import {
  globalStructure,
  meetingInfo,
  applicationType,
} from './data/fixtureData';

// Routing
import { cieHandler } from './cieHandler';
import { listHandler } from './listHandler';
import { recruitersHandler } from './recruiters/recruitersHandler';
import { analyticHandler } from './analyticHandler';
import { paramHandler } from './paramHandler';
import { convertDataStructure, writeUserToDB } from './userHandler';

// Vars:
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  cookie_secret,
  callbackURL,
} from '../config.js';

const uiFile = path.join(__dirname, '../dist/');
// Passport session setup.
passport.serializeUser((user, done) => {
  const cleanUser = convertDataStructure(user as User);
  writeUserToDB(cleanUser).then(() => done(null, cleanUser))
    .catch((err) => {
      console.log('writeUserToDB CATCH', err);
    });
});

passport.deserializeUser((obj:User, done) => {
  done(null, obj);
});

passport.use('google', new GoogleStrategy(
  {
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL,
    passReqToCallback: true,
  },
  (request:Request, accessToken:string, refreshToken:string, profile:any, done:Function) => {
    process.nextTick(() => done(null, profile));
  },
));

passport.use('local', new LocalStrategy((username:string, password:string, done) => {
  const user = {
    provider: 'local-login',
    displayName: 'Demo User',
    email: 'demouser@example.com',
    gender: 'unknown',
  };
  return done(null, user);
}));

// configure Express
log.info({ fnct: 'App' }, 'Starting the App.js file');
const app = express();
app.use(cors());
app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'ejs');
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: cookie_secret,
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

app.get('/login', (req, res) => {
  res.render('login', { user: req.user });
});
app.get('/auth/google', passport.authenticate('google', {
  scope: ['https://www.googleapis.com/auth/plus.profile.emails.read'],
}));
app.get('/auth/google/callback', passport.authenticate('google', {
  successRedirect: '/',
  failureRedirect: '/login',
}));
app.post('/auth/demo', passport.authenticate('local', { failureRedirect: '/login' }), (req, res) => {
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/login');
});
app.use(ensureAuthenticated); // Everything after this need to be authenticated
app.use(express.static(uiFile));
// Get info
app.get('/log/all', (req, res) => res.json(getBunyanLog('all')));
app.get('/log', (req, res) => res.json(getBunyanLog('info')));
app.get('/json/basicparam', (req, res) => {
  // Empty object, Still ????
  res.json({ emptyObject: globalStructure, meetingInfo, applicationType });
});
app.use('/json/param', paramHandler);
app.use('/json/cie', cieHandler);
app.use('/json/list', listHandler);
app.use('/json/recruiters', recruitersHandler);
app.use('/json/analytic', analyticHandler);

app.get('/*', (req, res) => {
  res.sendFile(uiFile);
});

// Catch if no route match.
app.use(routeNotFound); // Should never reach here since the Front-end should catch it. ???

// Error handler section
app.use(handleDatabaseError);
app.use(genericErrorHandling);

app.dBconnect = dBconnect;

function ensureAuthenticated(req:Request, res:Response, next:NextFunction) {
  if (process.env.NODE_ENV === 'test') {
    req.user = { email: 'testuser@gmail.com' };
    return next();
  }
  if (process.env.NODE_ENV === 'dev' && process.env.USER_EMAIL) {
    req.user = { email: process.env.USER_EMAIL };
    return next();
  }
  if (req.isAuthenticated()) { return next(); }
  log.info({ fnct: 'ensureAuthenticated' }, 'REROUTE Login');
  return res.redirect('/login');
}

module.exports = app;
