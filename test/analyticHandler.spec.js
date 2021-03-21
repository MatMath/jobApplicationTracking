/* eslint-disable no-underscore-dangle */
const request = require('request');
const expect = require('expect.js');
const Joi = require('joi');

const port = 3456;
const url = `http://localhost:${port}/json`;
const analyticUrl = `${url}/analytic`;
const app = require('../src/app');
const { dBconnect } = require('../src/database');
const {
  analyticTitleSchema,
  globalStructure,
  gpsSchema,
  websiteInfoSchema,
} = require('../src/data/joiStructure');

let server;

const titleLoc = {
  title: 'FullStack',
  location: 'Dublin',
};

describe('Testing the Analytics', () => {
  before((done) => {
    process.env.DBJOBS = 'testjobs';
    process.env.DBCIE = 'testcie';
    process.env.DBRECRU = 'testrecruiters';
    dBconnect()
      .then(() => new Promise((resolve) => {
        server = app.listen(port, resolve);
      }))
      .then(done);
  });
  after(() => {
    server.close();
  });

  describe('.analytic flow', function bob() {
    this.timeout(20000);
    // Delete all pending Jobs.
    it('delete all testing job to clean the DB', (done) => {
      // Delete info
      request.delete(`${url}/list`, (err, resp, info) => {
        expect(err).to.be(null);
        expect(JSON.parse(info).n).to.not.be(undefined);
        done();
      });
    });

    // Add the proper job list.
    it('Add a new job in the DB', (done) => {
      const newApplication = {
        ...globalStructure,
        ...titleLoc,
        application: true,
        answer_receive: true,
        company: 'Annoying',
        website: 'linkedIn',
        recruiters: 'spamming bot',
        title: 'FullStack',
      };
      let tmp = [true, true, false, false].map((test) => { return { ...newApplication, answer_receive: test }; }); // eslint-disable-line arrow-body-style
      tmp = [...tmp, { ...newApplication, website: 'Zip', title: 'Front-end' }];
      Promise.all(tmp.map(job => request.post(`${url}/list`, { json: job }))) // Adding 4 linkedIn & 1 Zip.
        .then((all) => {
          expect(all).to.have.length(5);
          done();
        });
    });

    // test the aggregation.
    it('.website list structure', (done) => {
      setTimeout(() => {
        request.get(`${analyticUrl}/website`, (error, response, body) => {
          expect(error).to.be(null);
          expect(response.statusCode).to.be(200);
          const data = JSON.parse(body);
          expect(data).to.have.length(2);

          const zipObj = data.filter(a => a._id === 'Zip')[0]; // Cannot make Contain work for some reason :/
          expect(zipObj.count).to.be(1);
          expect(zipObj.answer_receive).to.be(1);

          const linkObj = data.filter(a => a._id === 'linkedIn')[0];
          expect(linkObj.count).to.be(4);
          expect(linkObj.answer_receive).to.be(2);

          Joi.assert(data[0], websiteInfoSchema)
          done();
        });
      }, 2000); // Somehow the Promise.all take time to save to the DB and return a Ack and not a confirmation. (cue)
    });

    it('.title', (done) => {
      request.get(`${analyticUrl}/title`, (error, response, body) => {
        const data = JSON.parse(body);
        expect(data).to.have.length(2);

        const fullStackObj = data.filter(a => a._id === 'FullStack')[0];
        expect(fullStackObj.count).to.be(4);

        const fEndObj = data.filter(a => a._id === 'Front-end')[0];
        expect(fEndObj.count).to.be(1);

        Joi.assert(data[0], analyticTitleSchema)
        done();
      });
    });
  });

  xit('Validate the GPS list structure', (done) => {
    request.get(`${analyticUrl}/gps`, (error, response, body) => {
      expect(error).to.be(null);
      expect(response.statusCode).to.be(200);
      const data = JSON.parse(body);
      expect(data.length).to.not.be(0);
      Joi.assert(data[0], gpsSchema)
      done();
    });
  });
});
