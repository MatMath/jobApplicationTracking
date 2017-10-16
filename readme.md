# Jobs tracking

Job application tracking can get tedious with applying on different websites, different company, location, and many recruiters that all propose something... So instead of putting everything in a Excel file I wanted to regroup everything.

### Prerequisites
Install MongoDB Atlas (DB as a service) Or you can also install it locally.

### Getting Started
- $ cp config.sample.json config.json -> Update the Mongo URL to your config.json
- $ npm install
- $ npm start
Now the server is running.

## Running the tests
$ npm test

### Flow:
Post new Company,
Post new Recruiters,
Add new listing link with Cie and Recruiters.

Querry:
Done - Get all cie, Recruiters, list
todo - Extract Cie Gps?

## Todo:
- (See issue)
- Link Cie & Recruteurs to New posting
- Deployment script
- Front-end to retrieve / input data.
- Passport security?
- Optimisation: Find how to use a link to link Cie & Recruiters list to the Listing.

## Deployment
TODO -> CircleCI -> Docker -> AWS ?
