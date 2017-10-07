const request = require('request');
const expect = require('expect.js');

const port = 3456;
const url = `http://localhost:${port}`;
const app = require('../src/app');
const { globalStructure, meetingInfo, applicationType } = require('../src/objectStructure');

let server;

describe('Testing the flow', () => {
  before((done) => {
    process.env.DBJOBS = 'testjobs';
    process.env.DBCIE = 'testcie';
    app.initialize();
    server = app.listen(port, () => {
      console.log(`Express server listening on port ${server.address().port}`);
      setTimeout(done, 1000);
    });
  });
  after(() => {
    server.close();
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

  it('Set a new listing in the DB', (done) => {
    const newApplication = { ...globalStructure, location: 'over the rainbow' };
    request.post(`${url}/newapp`, { form: newApplication }, (err, resp, body) => {
      expect(err).to.be(null);
      expect(resp.statusCode).to.be(302);
      request.get(`${url}/view`, (error, response, answerbody) => {
        expect(error).to.be(null);
        expect(response.statusCode).to.be(200);
        expect(answerbody.length).to.be.greaterThan(0);
        done();
      });
    });
  });
});
