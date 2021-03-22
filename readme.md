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
#### MongoDB:
Install MongoDB Atlas (DB as a service) Or you can also install it locally.
Collection needed inside the DB:
- JobTracking (or any DB name)
  - company
  - jobapplication 
  - recruiters
  - user

If you run it locally, Install `mongo` command line interface:
- `$ mongo`

Inside `mongo` command line interface
- `$ use jobTracking`

Create all collection:
- `$ db.company.insertOne({});`
- `$ db.jobapplication.insertOne({})`;
- `$ db.recruiters.insertOne({});`
- `$ db.user.insertOne({});`

Or use the Compass UI to create each collection manually.

#### SSH Certificate locally:
(some info here)[https://flaviocopes.com/express-https-self-signed-certificate/]

### Getting Started
- $ cp config.sample.js config.js -> Update the Mongo URL to your config.js
- $ npm install
- $ npm start
Now the server is running & serving the login page & dist folder when Authenticated (angular App)
To run the server & the Angular App separately (without building/copying every time)
- `$ USER=1234567 npm run start-dev`; // Add your personalID that have value in the DB.

## Running the tests
`$ npm test`

### Flow:
Login via passport -> Get the Data -> Store user data into a User Container of MongoDB.
Get the User (Cie, Recru, List) name from his profile. (Based on the parsed Google ID)

Option on the DB:
- CRUD new Company
- CRUD new Recruiters
- CRUD new listing

## Todo:
- (See issue)
- Deployment script
- Init script to setup the DB structure.

## Deployment

### EC2

Spin up a new micro instance, associate an elastic IP address to it. Setup a security group with ports 22 (ssh), 80, 443 (tcp).

Install nginx, and confirm that your nginx is up and running on port 80 by going to your IP address http://11.11.11.11:80.

### DNS

To begin, you will need a domain name that you own. Add an "A record" for your domain name, which points to your elastic IP address. Wait for it to resolve (15 min to 24 hours). Confirm that your dns is up and running by going to your domain name http://yourdomain.com, you should see the same nginx placeholder as you did in the above step.

### HTTPS

Once your domain name resolves, install certbot on your EC2 instance. Confirm that your nginx is up and running on port 443 and you have a trusted certificate, by going to your https domain name https://yourdomain.com
(Certbot)[https://certbot.eff.org/lets-encrypt/ubuntubionic-nginx]
Certbot renew notes: Your cert will expire on 2019-06-07. To obtain a new or tweaked version of this certificate in the future, simply run certbot again with the "certonly" option. To non-interactively renew *all* of your certificates, run "certbot renew"



### Web service


locashost certificate for SSL…
openssl req -x509 -out localhost.crt -keyout localhost.key -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' -extensions EXT -config <( printf "[dn]\nCN=localhost\n[req]\ndistinguished_name = dn\n[EXT]\nsubjectAltName=DNS:localhost\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth")


On the server export `NODE_ENV=production`, this will indicate to express and other libraries that they are running in production mode and should log less and handle errors differently. The service also uses this to detect that it is running behind an nginx proxy, so it will run on http.

### Nginx Proxy

After your webservice is up and running, edit your nginx config to proxy_pass to your webservice. (see wiki)[https://www.nginx.com/resources/wiki/start/topics/examples/full/]
location {
  proxy_pass  http://127.0.0.1:8080;
}
