/* eslint-disable no-underscore-dangle */
const request = require('request');
const expect = require('expect.js');
const Joi = require('joi');

const port = 3456;
const url = `http://localhost:${port}`;
const app = require('../src/app');
const {
  globalStructure,
  globalStructureSchema,
  company,
  companySchema,
  recruitersInfo,
  recruitersInfoSchema,
} = require('../src/objectStructure');

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

  it('Test the Default data structure', (done) => {
    const cie = { ...company, name: 'NoWhere', location: 'Everywhere' };
    const recru = { ...recruitersInfo, cie: 'Annoying', name: 'spamming bot' };
    const list = { ...globalStructure, company: cie, recruiters: recru };
    Joi.validate(cie, companySchema)
      .then(() => Joi.validate(recru, recruitersInfoSchema))
      .then(() => Joi.validate(list, globalStructureSchema))
      .then(() => done())
      .catch((err) => {
        expect(err).to.be(null);
      });
  });

  describe('Recruiters flow', () => {
    it('delete all testing RecruitersInfo to clean the DB', (done) => {
      // Delete info
      request.delete(`${url}/recruiters`, { json: { info: 'not real info' } }, (err, resp, info) => {
        expect(err).to.be(null);
        expect(info.n).to.not.be(undefined);
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
      const newApplication = { ...recruitersInfo, name: 'Bob the Recruiters', cie: 'water world' };
      request.post(`${url}/recruiters`, { json: newApplication }, (err, resp) => {
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

    it('Add a new RecruitersInfo with missing info', (done) => {
      // Add Recru
      const newApplication = { ...recruitersInfo, name: 'Bob the Recruiters' };
      request.post(`${url}/recruiters`, { json: newApplication }, (err, resp) => {
        expect(err).to.be(null);
        expect(resp.statusCode).to.be(400);
        done();
      });
    });

    it('Update a Recruiters with missing info', (done) => {
      request.put(`${url}/recruiters`, { json: { id: iDToDelete.recruiters } }, (err, resp) => {
        expect(err).to.be(null);
        expect(resp.statusCode).to.be(400);
        done();
      });
    });

    it('Update a Recruiters info from the System', (done) => {
      const replacement = { ...recruitersInfo, name: 'The trustworthy', cie: 'MoneyMan' };
      request.get(`${url}/recruiters`, (error, response, body) => {
        const initLength = JSON.parse(body).length;
        request.put(`${url}/recruiters`, { json: { id: iDToDelete.recruiters, data: replacement } }, (err, resp) => {
          expect(err).to.be(null);
          expect(resp.statusCode).to.be(302);
          request.get(`${url}/recruiters`, (e, r, info) => {
            expect(e).to.be(null);
            const final = JSON.parse(info);
            expect(final.length).to.be(initLength);
            expect(final[0].name).to.be(replacement.name);
            done();
          });
        });
      });
    });

    it('Delete a specific Recruiters', (done) => {
      const newApplication = { ...recruitersInfo, name: 'Bob the re-re-Recruiters', cie: 'under world' };
      request.post(`${url}/recruiters`, { json: newApplication }, (e, r) => {
        expect(e).to.be(null);
        expect(r.statusCode).to.be(302);
        // Get Recru
        request.delete(`${url}/recruiters`, { json: { id: iDToDelete.recruiters } }, (err, resp, info) => {
          expect(err).to.be(null);
          expect(info.n).to.not.be(undefined);
          request.get(`${url}/recruiters`, (error, response, body) => {
            expect(error).to.be(null);
            expect(response.statusCode).to.be(200);
            const parsed = JSON.parse(body);
            expect(parsed[0]._id).to.not.be(iDToDelete.recruiters);
            done();
          });
        });
      });
    });
  });

  describe('Cie Flow', () => {
    it('delete all testing Cie to clean the DB', (done) => {
      // Delete info
      request.delete(`${url}/cie`, { json: { info: 'not real info' } }, (err, resp, info) => {
        expect(err).to.be(null);
        expect(info.n).to.not.be(undefined);
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
      request.post(`${url}/cie`, { json: newApplication }, (err, resp) => {
        expect(err).to.be(null);
        expect(resp.statusCode).to.be(302);
        // Get Cie
        request.get(`${url}/cie`, (error, response, body) => {
          expect(error).to.be(null);
          expect(response.statusCode).to.be(200);
          const parsed = JSON.parse(body);
          iDToDelete.cie = parsed[0]._id;
          expect(parsed.length).to.be(1);
          expect(parsed[0].name).to.be('AMC, Awesome Complex Cie');
          done();
        });
      });
    });
    it('Add a new cie with missing info', (done) => {
      // Add Recru
      const newApplication = { ...company, name: 'Still missing info' };
      request.post(`${url}/cie`, { json: newApplication }, (err, resp) => {
        expect(err).to.be(null);
        expect(resp.statusCode).to.be(400);
        done();
      });
    });
    it('Update a Recruiters with missing info', (done) => {
      request.put(`${url}/cie`, { json: { id: iDToDelete.cie } }, (err, resp) => {
        expect(err).to.be(null);
        expect(resp.statusCode).to.be(400);
        done();
      });
    });
    it('Update a cie info from the System', (done) => {
      const replacement = { ...company, name: 'Fun Fun Cie', location: 'Dublin' };
      request.get(`${url}/cie`, (error, response, body) => {
        const initLength = JSON.parse(body).length;
        request.put(`${url}/cie`, { json: { id: iDToDelete.cie, data: replacement } }, (err, resp) => {
          expect(err).to.be(null);
          expect(resp.statusCode).to.be(302);
          request.get(`${url}/cie`, (e, r, info) => {
            expect(e).to.be(null);
            const final = JSON.parse(info);
            expect(final.length).to.be(initLength);
            expect(final[0].name).to.be(replacement.name);
            done();
          });
        });
      });
    });

    it('Delete a specific cie', (done) => {
      const newCie = { ...company, name: 'Only listed Cie', location: 'under world' };
      request.post(`${url}/cie`, { json: newCie }, (e, r) => {
        expect(e).to.be(null);
        expect(r.statusCode).to.be(302);
        // Get Recru
        request.delete(`${url}/cie`, { json: { id: iDToDelete.cie } }, (err, resp, info) => {
          expect(err).to.be(null);
          expect(info.n).to.not.be(undefined);
          request.get(`${url}/cie`, (error, response, body) => {
            expect(error).to.be(null);
            expect(response.statusCode).to.be(200);
            const parsed = JSON.parse(body);
            expect(parsed[0]._id).to.not.be(iDToDelete.recruiters);
            done();
          });
        });
      });
    });
  });

  describe('List Flow', () => {
    it('delete all testing listing to clean the DB', (done) => {
      // Delete info
      request.delete(`${url}/list`, { json: { info: 'not real info' } }, (err, resp, info) => {
        expect(err).to.be(null);
        expect(info.n).to.not.be(undefined);
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
      request.post(`${url}/list`, { json: { info: 'not real info' } }, (err, resp) => {
        expect(err).to.be(null);
        expect(resp.statusCode).to.be(400);
        done();
      });
    });
    it('Add a new listing in the DB', (done) => {
      const cie = { ...company, name: 'NoWhere', location: 'Everywhere' };
      const recru = { ...recruitersInfo, cie: 'Annoying', name: 'spamming bot' };
      const newApplication = {
        ...globalStructure,
        company: cie,
        recruiters: recru,
        title: 'FullStack',
      };
      request.post(`${url}/list`, { json: newApplication }, (err, resp) => {
        expect(err).to.be(null);
        expect(resp.statusCode).to.be(302);
        request.get(`${url}/list`, (error, response, body) => {
          expect(error).to.be(null);
          expect(response.statusCode).to.be(200);
          const parsed = JSON.parse(body);
          iDToDelete.listing = parsed[0]._id;
          expect(parsed.length).to.be(1);
          expect(parsed[0].title).to.be(newApplication.title);
          expect(parsed[0]._id).to.not.be(undefined);
          done();
        });
      });
    });
    it('Update a listing info from the System', (done) => {
      const cie = { ...company, name: 'NoWhere', location: 'Everywhere' };
      const recru = { ...recruitersInfo, cie: 'Annoying', name: 'spamming bot' };
      const differentApplication = {
        ...globalStructure,
        company: cie,
        recruiters: recru,
        title: 'NodeJs API Dev',
      };
      request.get(`${url}/list`, (error, response, body) => {
        const initLength = JSON.parse(body).length;
        request.put(`${url}/list`, { json: { id: iDToDelete.listing, data: differentApplication } }, (err, resp) => {
          expect(err).to.be(null);
          expect(resp.statusCode).to.be(302);
          request.get(`${url}/list`, (e, r, info) => {
            expect(e).to.be(null);
            const final = JSON.parse(info);
            expect(final.length).to.be(initLength);
            expect(final[0].title).to.be(differentApplication.title);
            done();
          });
        });
      });
    });

    it('Delete a specific listing', (done) => {
      const cie = { ...company, name: 'NoWhere', location: 'Everywhere' };
      const recru = { ...recruitersInfo, cie: 'Annoying', name: 'spamming bot' };
      const newCie = {
        ...globalStructure,
        company: cie,
        recruiters: recru,
        title: 'FrontEnd Specialist not in VueJs',
      };
      request.post(`${url}/list`, { json: newCie }, (e, r) => {
        expect(e).to.be(null);
        expect(r.statusCode).to.be(302);
        // Get Recru
        request.delete(`${url}/list`, { json: { id: iDToDelete.listing } }, (err, resp, info) => {
          expect(err).to.be(null);
          expect(info.n).to.not.be(undefined);
          request.get(`${url}/list`, (error, response, body) => {
            expect(error).to.be(null);
            expect(response.statusCode).to.be(200);
            const parsed = JSON.parse(body);
            expect(parsed[0]._id).to.not.be(iDToDelete.listing);
            done();
          });
        });
      });
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
