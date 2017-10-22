// Generic libs
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth2').Strategy;
const cookieParser = require('cookie-parser');
// Tmp until I understand and then store it in Mongo Directly
const session = require('express-session');
const RedisStore = require('connect-redis')(session);

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

// Vars:
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, cookie_secret } = require('../config.json');

// Passport session setup.
passport.serializeUser((user, done) => {
  // TODO: Call DB
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  // TODO: ????
  done(null, obj);
});

passport.use(new GoogleStrategy(
  {
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    // Carefull ! and avoid usage of Private IP, otherwise you will get the device_id device_name issue for Private IP during authentication
    // The workaround is to set up thru the google cloud console a fully qualified domain name such as http://mydomain:3000/
    // then edit your /etc/hosts local file to point on your private IP.
    // Also both sign-in button + callbackURL has to be share the same url, otherwise two cookies will be created and lead to lost your session
    // if you use it.
    callbackURL: 'http://localhost:3001/auth/google/callback',
    passReqToCallback: true,
  },
  (request, accessToken, refreshToken, profile, done) => {
    // asynchronous verification, for effect...
    // TODO: Add a DB Call/Extraction to get the proper USER DB(ish)
    process.nextTick(() => done(null, profile));
  },
));

// configure Express
log.info({ fnct: 'App' }, 'Starting the App.js file');
const app = express();
app.use(cors());
app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, '/public')));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: cookie_secret,
  name: 'kaas',
  store: new RedisStore({
    host: '127.0.0.1',
    port: 6379,
  }),
  proxy: true,
  resave: true,
  saveUninitialized: true,
}));
app.use(passport.initialize());
app.use(passport.session());

app.get('/login', (req, res) => {
  res.render('login', { user: req.user });
});
// GET /auth/google
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Google authentication will involve
//   redirecting the user to google.com.  After authorization, Google
//   will redirect the user back to this application at /auth/google/callback
app.get('/auth/google', passport.authenticate('google', {
  scope: ['https://www.googleapis.com/auth/plus.login', 'https://www.googleapis.com/auth/plus.profile.emails.read'],
}));

// GET /auth/google/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get(
  '/auth/google/callback',
  passport.authenticate('google', {
    successRedirect: '/',
    failureRedirect: '/login',
  }),
);

app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

// Get info
app.get('/log/all', (req, res) => res.json(getBunyanLog('all')));
app.get('/log', ensureAuthenticated, (req, res) => res.json(getBunyanLog('info')));
app.get('/basicparam', (req, res) => {
  res.json({ emptyObject: globalStructure, meetingInfo, applicationType });
});
app.use('/cie', cieHandler);
app.use('/list', listHandler);
app.use('/recruiters', recruitersHandler);

app.get('/', ensureAuthenticated, (req, res) => {
  res.sendFile(`${__dirname}/index.html`); // TODO Switch that the the UI app.
});

// Catch if no route match.
app.use(routeNotFound);

// Error handler section
app.use(handleDatabaseError);
app.use(genericErrorHandling);

app.dBconnect = dBconnect;

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  return res.redirect('/login');
}

module.exports = app;
