// Generic libs
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth2').Strategy;
const cookieParser = require('cookie-parser');
// Tmp until I understand and then store it in Mongo Directly
const session = require('express-session');

// custom libs
const { log, getBunyanLog } = require('./logs');
const { dBconnect, handleDatabaseError } = require('./database');
const { routeNotFound, genericErrorHandling } = require('./errorHandling');
const {
  globalStructure,
  meetingInfo,
  applicationType,
} = require('./objectStructure');

// Routing
const cieHandler = require('./cieHandler');
const listHandler = require('./listHandler');
const recruitersHandler = require('./recruitersHandler');
const analyticHandler = require('./analyticHandler');
const paramHandler = require('./paramHandler');
const { convertDataStructure, writeUserToDB } = require('./userHandler');

// Vars:
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  cookie_secret,
  callbackURL,
} = require('../config.json');

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
    process.nextTick(() => done(null, profile));
  },
));

passport.use('local', new LocalStrategy((username, password, done) => {
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

app.dBconnect = dBconnect;

function ensureAuthenticated(req, res, next) {
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
