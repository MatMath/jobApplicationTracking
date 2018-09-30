# Jobs tracking

Job application tracking can get tedious with applying on different websites, different company, location, and many recruiters that all propose something... So instead of putting everything in a Excel file I wanted to regroup everything.

### Tech Stack
##### BE (this repo):
- Auth with Passport (google-oauth2 & Local)
- Node/Express API
- MongoDB

##### (FE)[https://github.com/MatMath/jobApplicationTrackingUI]:
- Angular
- Bootstrap
- Rickshaw (for simple graph)

### Prerequisites
Install MongoDB Atlas (DB as a service) Or you can also install it locally.

### Getting Started
- $ cp config.sample.json config.json -> Update the Mongo URL to your config.json
- $ npm install
- $ npm start
Now the server is running & serving the login page & dist folder when Authenticated (angular App)
To run the server & the Angular App separately (without building/copying every time)
- $ USER_EMAIL=wonderful.person.email@gmail.com npm run start-dev; // Add your email that have value in the DB.

## Running the tests
$ npm test

### Flow:
Login via passport -> Get the Data -> Store user data into a User Container of MongoDB.
Get the User (Cie, Recru, List) name from his profile. (Based on the parsed email?)

Option on the DB:
- CRUD new Company
- CRUD new Recruiters
- CRUD new listing

## Todo:
- (See issue)
- Deployment script

## Deployment
TODO -> CircleCI -> Docker -> AWS ?
