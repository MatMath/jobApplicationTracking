const request = require('request');
const expect = require('expect.js');

const port = 3456;
const url = `http://localhost:${port}`;
const app = require('../src/app');

let server;

describe('Testing the flow', () => {
  before(() => {
    server = app.listen(port, () => {
      console.log(`Express server listening on port ${server.address().port}`);
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
});
