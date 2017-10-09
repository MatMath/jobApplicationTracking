/* eslint-disable no-underscore-dangle */
const request = require('request');
const expect = require('expect.js');

const port = 3456;
const url = `http://localhost:${port}`;
const app = require('../src/app');
const { globalStructure, company, recruitersInfo } = require('../src/objectStructure');

let server;
const iDToDelete = {
  listing: '',
  cie: '',
  recruiters: '',
};

describe('Testing the flow', () => {
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
  describe.only('Recruiters flow', () => {
    it('delete all testing RecruitersInfo to clean the DB', (done) => {
      // Delete info
      request.delete(`${url}/recruiters`, { form: { info: 'not real info' } }, (err, resp, info) => {
        expect(err).to.be(null);
        expect(JSON.parse(info).n).to.not.be(undefined);
        // Get info -> Empty array
        request.get(`${url}/recruiters`, (error, response, body) => {
          expect(error).to.be(null);
          expect(response.statusCode).to.be(200);
          expect(JSON.parse(body).length).to.be(0);
          done();
        });
      });
    });

    it('Add a new RecruitersInfo in the System', (done) => {
      // Add Recru
      const newApplication = { ...recruitersInfo, name: 'Bob the Recruiters' };
      request.post(`${url}/recruiters`, { form: newApplication }, (err, resp) => {
        expect(err).to.be(null);
        expect(resp.statusCode).to.be(302);
        // Get Recru
        request.get(`${url}/recruiters`, (error, response, body) => {
          expect(error).to.be(null);
          expect(response.statusCode).to.be(200);
          const parsed = JSON.parse(body);
          iDToDelete.recruiters = parsed[0]._id;
          expect(parsed.length).to.be(1);
          expect(parsed[0].name).to.be('Bob the Recruiters');
          done();
        });
      });
    });

    it('Update a Recruiters info from the System', (done) => {
      const replacement = { ...recruitersInfo, name: 'The trustworth' };
      request.put(`${url}/recruiters`, { form: { id: iDToDelete.recruiters, data: replacement } }, (err, resp) => {
        console.log('error:', err, resp.message);
        expect(err).to.be(null);
        expect(resp.statusCode).to.be(302);
        done();
      });
    });

    it('Delete a specific Recruiters', () => {
      expect(false).to.be(true);
    });
  });

  describe('Cie Flow', () => {
    it('delete all testing Cie to clean the DB', (done) => {
      // Delete info
      request.delete(`${url}/cie`, { form: { info: 'not real info' } }, (err, resp, info) => {
        expect(err).to.be(null);
        expect(JSON.parse(info).n).to.not.be(undefined);
        // Get info -> Empty array
        request.get(`${url}/cie`, (error, response, body) => {
          expect(error).to.be(null);
          expect(response.statusCode).to.be(200);
          expect(JSON.parse(body).length).to.be(0);
          done();
        });
      });
    });

    it('Add a new Cie in the System', (done) => {
      // Add Cie
      const newApplication = { ...company, location: 'over the rainbow', name: 'AMC, Awesome Complex Cie' };
      request.post(`${url}/cie`, { form: newApplication }, (err, resp) => {
        expect(err).to.be(null);
        expect(resp.statusCode).to.be(302);
        // Get Cie
        request.get(`${url}/cie`, (error, response, body) => {
          expect(error).to.be(null);
          expect(response.statusCode).to.be(200);
          const parsed = JSON.parse(body);
          expect(parsed.length).to.be(1);
          expect(parsed[0].name).to.be('AMC, Awesome Complex Cie');
          done();
        });
      });
    });
    it('Update a Cie info from the System', () => {
      expect(false).to.be(true);
    });
    it('Delete a specific Cie', () => {
      expect(false).to.be(true);
    });
  });

  describe('List Flow', () => {
    it('delete all testing listing to clean the DB', (done) => {
      // Delete info
      request.delete(`${url}/list`, { form: { info: 'not real info' } }, (err, resp, info) => {
        expect(err).to.be(null);
        expect(JSON.parse(info).n).to.not.be(undefined);
        // Get info -> Empty array
        request.get(`${url}/list`, (error, response, body) => {
          expect(error).to.be(null);
          expect(response.statusCode).to.be(200);
          expect(JSON.parse(body).length).to.be(0);
          done();
        });
      });
    });

    it('Add a new listing with missing info', (done) => {
      request.post(`${url}/list`, { form: { info: 'not real info' } }, (err, resp) => {
        expect(err).to.be(null);
        expect(resp.statusCode).to.be(400);
        done();
      });
    });
    it('Add a new listing in the DB', (done) => {
      const newApplication = { ...globalStructure, location: 'over the rainbow' };
      request.post(`${url}/list`, { form: newApplication }, (err, resp) => {
        expect(err).to.be(null);
        expect(resp.statusCode).to.be(302);
        request.get(`${url}/list`, (error, response, body) => {
          expect(error).to.be(null);
          expect(response.statusCode).to.be(200);
          expect(JSON.parse(body).length).to.be(1);
          done();
        });
      });
    });

    it('Update a old listing from the System', () => {
      expect(false).to.be(true);
    });

    it('Delete a specific listing', () => {
      expect(false).to.be(true);
    });
  });

  it('Get the basic param', (done) => {
    request.get(`${url}/basicparam`, (err, resp, body) => {
      const { emptyObject, meetingInfo, applicationType } = JSON.parse(body);
      expect(emptyObject).to.not.be(undefined);
      expect(meetingInfo).to.not.be(undefined);
      expect(applicationType).to.not.be(undefined);
      done();
    });
  });
});
