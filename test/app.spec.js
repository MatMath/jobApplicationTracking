const request = require('request');
const expect = require('expect.js');

const port = 3456;
const url = `http://localhost:${port}`;
const app = require('../src/app');
const { globalStructure } = require('../src/objectStructure');

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
    app.initialize();
    server = app.listen(port, () => {
      console.log(`Express server listening on port ${server.address().port}`);
      setTimeout(done, 1000); // change the DB opening by promess instead.
    });
  });
  after(() => {
    server.close();
  });
  it('delete all testing listing to clean the DB', () => {
    // Get info,
    // Delete info
    // Get info -> Empty array
    expect(false).to.be(true);
  });

  it('delete all testing Cie to clean the DB', () => {
    // Delete info
    // Get info -> Empty array
    expect(false).to.be(true);
  });

  it('delete all testing RecruitersInfo to clean the DB', () => {
    // Delete info
    // Get info -> Empty array
    expect(false).to.be(true);
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

  it('Add a new Cie in the System', () => {
    // Add Cie
    // Get Cie
    expect(false).to.be(true);
  });

  it('Add a new RecruitersInfo in the System', () => {
    // Add Cie
    // Get Cie
    expect(false).to.be(true);
  });

  it('Add a new listing with missing info', (done) => {
    request.post(`${url}/newapp`, { form: { info: 'not real info' } }, (err, resp) => {
      expect(err).to.be(null);
      expect(resp.statusCode).to.be(400);
      done();
    });
  });

  it('Add a new listing in the DB', (done) => {
    const newApplication = { ...globalStructure, location: 'over the rainbow' };
    request.post(`${url}/newapp`, { form: newApplication }, (err, resp) => {
      expect(err).to.be(null);
      expect(resp.statusCode).to.be(302);
      request.get(`${url}/view`, (error, response, body) => {
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

  it('Update a Recruiters info from the System', () => {
    expect(false).to.be(true);
  });

  it('Update a Cie info from the System', () => {
    expect(false).to.be(true);
  });

  it('Delete a specific listing', () => {
    expect(false).to.be(true);
  });
  it('Delete a specific Recruiters', () => {
    expect(false).to.be(true);
  });
  it('Delete a specific Cie', () => {
    expect(false).to.be(true);
  });
});
