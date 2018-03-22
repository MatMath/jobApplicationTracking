/* eslint-disable no-underscore-dangle */
const request = require('request');
const expect = require('expect.js');
const Joi = require('joi');

const port = 3456;
const url = `http://localhost:${port}/json/analytic`;
const app = require('../src/app');
const {
  gpsSchema,
  websiteInfoSchema,
} = require('../src/objectStructure');

let server;

describe('Testing the Analytics', () => {
  before((done) => {
    process.env.DBJOBS = 'testjobs';
    process.env.DBCIE = 'testcie';
    process.env.DBRECRU = 'testrecruiters';
    app.dBconnect().then(() => {
      server = app.listen(port, () => {
        console.log(`Express server listening on port ${server.address().port}`);
        done();
      });
    });
  });
  after(() => {
    server.close();
  });

  it.only('Validate the website list structure', (done) => {
    request.get(`${url}/website`, (error, response, body) => {
      expect(error).to.be(null);
      expect(response.statusCode).to.be(200);
      const data = JSON.parse(body);
      expect(data.length).to.not.be(0);
      Joi.validate(data[0], websiteInfoSchema).then(done);
    });
  });

  it('Validate the GPS list structure', (done) => {
    request.get(`${url}/gps`, (error, response, body) => {
      expect(error).to.be(null);
      expect(response.statusCode).to.be(200);
      const data = JSON.parse(body);
      expect(data.length).to.not.be(0);
      Joi.validate(data[0], gpsSchema).then(done);
    });
  });
});
