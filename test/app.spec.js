/* eslint-disable no-underscore-dangle */
const request = require('request');
const expect = require('expect.js');
const Joi = require('joi');

const port = 3456;
const url = `http://localhost:${port}/json`;
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
const titleLoc = {
  title: 'FullStack',
  location: 'Dublin',
};

describe('Testing the flow', function bob() {
  this.timeout(20000);
  before((done) => {
    process.env.DBJOBS = 'testjobs';
    process.env.DBCIE = 'testcie';
    process.env.DBRECRU = 'testrecruiters';
    app.dBconnect()
      .then(() => new Promise((resolve) => {
        server = app.listen(port, resolve);
      }))
      .then(done);
  });
  after(() => {
    server.close();
  });

  it('Test the Default data structure', (done) => {
    const cie = {
      ...company,
      name: 'NoWhere',
      location: 'Everywhere',
      email: 'test',
    };
    const recru = {
      ...recruitersInfo,
      cie: 'Annoying',
      name: 'spamming bot',
      email: 'test',
    };
    const list = {
      ...globalStructure,
      ...titleLoc,
      company: 'string1',
      recruiters: 'string2',
      email: 'test',
    };
    Joi.assert(cie, companySchema);
    Joi.assert(recru, recruitersInfoSchema);
    Joi.assert(list, globalStructureSchema);
    done();
  });

  describe('Recruiters flow', () => {
    it('delete all testing RecruitersInfo to clean the DB', (done) => {
      // Delete info
      request.delete(`${url}/recruiters/`, { bob: 'bob' }, (err, resp, info) => {
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
      const newApplication = { ...recruitersInfo, name: 'Bob the Recruiters', cie: 'water world' };
      request.post(`${url}/recruiters`, { json: newApplication }, (err, resp) => {
        expect(err).to.be(null);
        expect(resp.statusCode).to.be(200);
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
      request.put(`${url}/recruiters`, { json: { _id: iDToDelete.recruiters } }, (err, resp) => {
        expect(err).to.be(null);
        expect(resp.statusCode).to.be(400);
        done();
      });
    });

    it('Update a Recruiters info from the System', (done) => {
      const replacement = {
        ...recruitersInfo,
        name: 'The trustworthy',
        cie: 'MoneyMan',
        _id: iDToDelete.recruiters,
      };
      request.get(`${url}/recruiters`, (error, response, body) => {
        const initLength = JSON.parse(body).length;
        request.put(`${url}/recruiters`, { json: replacement }, (err, resp) => {
          expect(err).to.be(null);
          expect(resp.statusCode).to.be(200);
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
        expect(r.statusCode).to.be(200);
        // Get Recru
        request.delete(`${url}/recruiters/${iDToDelete.recruiters}`, (err, resp, info) => {
          expect(err).to.be(null);
          expect(JSON.parse(info).n).to.not.be(undefined);
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
      request.delete(`${url}/cie`, (err, resp, info) => {
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
      request.post(`${url}/cie`, { json: newApplication }, (err, resp) => {
        expect(err).to.be(null);
        expect(resp.statusCode).to.be(200);
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
    it('Update a compagnie with missing info', (done) => {
      request.put(`${url}/cie`, { json: { _id: iDToDelete.cie } }, (err, resp) => {
        expect(err).to.be(null);
        expect(resp.statusCode).to.be(400);
        done();
      });
    });
    it('Update a cie info from the System', (done) => {
      const replacement = {
        ...company,
        name: 'Fun Fun Cie',
        location: 'Dublin',
        _id: iDToDelete.cie,
      };
      request.get(`${url}/cie`, (error, response, body) => {
        const initLength = JSON.parse(body).length;
        request.put(`${url}/cie`, { json: replacement }, (err, resp) => {
          expect(err).to.be(null);
          expect(resp.statusCode).to.be(200);
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
        expect(r.statusCode).to.be(200);
        // Get Recru
        request.delete(`${url}/cie/${iDToDelete.cie}`, (err, resp, info) => {
          expect(err).to.be(null);
          expect(JSON.parse(info).n).to.not.be(undefined);
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
      request.delete(`${url}/list`, (err, resp, info) => {
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
      request.post(`${url}/list`, { json: { info: 'not real info' } }, (err, resp) => {
        expect(err).to.be(null);
        expect(resp.statusCode).to.be(400);
        done();
      });
    });
    it('Add a new listing in the DB', (done) => {
      const newApplication = {
        ...globalStructure,
        ...titleLoc,
        company: 'Annoying',
        recruiters: 'spamming bot',
        title: 'FullStack',
      };
      request.post(`${url}/list`, { json: newApplication }, (err, resp) => {
        expect(err).to.be(null);
        expect(resp.statusCode).to.be(200);
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

    it('Validate we can get a specific ID', (done) => {
      request.get(`${url}/list/${iDToDelete.listing}`, (err, resp, body) => {
        expect(err).to.be(null);
        expect(resp.statusCode).to.be(200);
        const parsed = JSON.parse(body);
        expect(parsed._id).to.be(iDToDelete.listing);
        done();
      });
    });

    it('Update a listing info from the System', (done) => {
      const differentApplication = {
        ...globalStructure,
        ...titleLoc,
        _id: iDToDelete.listing,
        company: 'Will Be Awesome',
        recruiters: 'NA',
        title: 'NodeJs API Dev',
      };
      request.get(`${url}/list`, (error, response, body) => {
        const initLength = JSON.parse(body).length;
        request.put(`${url}/list`, { json: differentApplication }, (err, resp) => {
          expect(err).to.be(null);
          expect(resp.statusCode).to.be(200);
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
      const newCie = {
        ...globalStructure,
        ...titleLoc,
        company: 'NoWhere',
        recruiters: 'spamming bot 2',
        title: 'FrontEnd Specialist not in VueJs',
      };
      request.post(`${url}/list`, { json: newCie }, (e, r) => {
        expect(e).to.be(null);
        expect(r.statusCode).to.be(200);
        // Get Recru
        request.delete(`${url}/list/${iDToDelete.listing}`, (err, resp, info) => {
          expect(err).to.be(null);
          expect(JSON.parse(info).n).to.not.be(undefined);
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
