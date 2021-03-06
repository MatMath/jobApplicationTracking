// Generic libs
import express from 'express';
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require ('passport-google-oauth2').Strategy;
const cookieParser = require('cookie-parser');
// Tmp until I understand and then store it in Mongo Directly
const session = require('express-session');
import {UserDetails} from './data/types'

// custom libs
import { log, getBunyanLog } from './logs';
import { handleDatabaseError } from './database';
import { routeNotFound, genericErrorHandling } from './errorHandling';
import {
  globalStructure,
  meetingInfo,
  applicationType,
} from './data/fixture';

// Routing
import { analyticHandler } from './analyticHandler';
import { cieHandler } from './cieHandler';
import { listHandler } from './listHandler';
import { paramHandler } from './paramHandler';
import { recruitersHandler } from './recruitersHandler';
import { convertDataStructure, writeUserToDB } from './userHandler';

// Vars:
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  cookie_secret,
  callbackURL,
} = require('../config.js');

const uiFile = path.join(__dirname, '../dist/');
// Passport session setup.
passport.serializeUser((user, done) => {
  const cleanUser = convertDataStructure(user);
  writeUserToDB(cleanUser).then(() => done(null, cleanUser))
    .catch((err) => {
      console.log('IN THE CATCH', err);
    });
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

passport.use('google', new GoogleStrategy(
  {
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL,
    passReqToCallback: true,
  },
  (request, accessToken, refreshToken, profile, done) => {
    console.log('PROFILE Back: ', profile);
    process.nextTick(() => done(null, profile));
  },
));

passport.use('local', new LocalStrategy((username, password, done) => {
  const user = {
    id: 'Demo User',
    displayName: 'Demo User'
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
  scope: ['openid', 'profile'],
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
app.use(ensureAuthenticated); // Everything after is Locked
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

function ensureAuthenticated(req, res, next) {
  if (process.env.NODE_ENV === 'test') {
    req.user = { userId: 'testuser@gmail.com', displayName: 'testuser' }
    return next();
  }
  if (process.env.NODE_ENV === 'dev' && process.env.USER) {
    req.user = { userId: process.env.USER };
    return next();
  }
  if (req.isAuthenticated() && req.user && req.user.userId) { return next(); }
  log.info({ fnct: 'ensureAuthenticated' }, 'REROUTE Login');
  return res.redirect('/login');
}

module.exports = app;
