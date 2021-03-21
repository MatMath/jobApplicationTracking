const Joi = require('joi');
// Joi.objectId = require('joi-objectid')(Joi);

const company = {
  name: undefined,
  location: undefined,
  gps: {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [125, 10],
    },
    properties: {
      name: 'Dinagat Islands',
    },
  },
  contact: undefined,
  link: undefined,
};

const gpsSchema = Joi.object({
  type: Joi.string(),
  geometry: {
    type: Joi.string(),
    coordinates: Joi.array().items(Joi.number()),
  },
  properties: {
    name: Joi.string(),
  },
});

const analyticTitleSchema = Joi.object({
  _id: Joi.string(),
  count: Joi.number(),
});

const companySchema = Joi.object({
  _id: Joi.string(),
  email: Joi.string().required(),
  name: Joi.string().required(),
  location: Joi.string().required(),
  gps: gpsSchema,
  contact: Joi.string().allow('').allow(null),
  link: Joi.string().allow('').allow(null),
});

const recruitersInfo = {
  cie: undefined,
  name: undefined,
  notes: undefined,
};

const recruitersInfoSchema = Joi.object({
  _id: Joi.string(),
  email: Joi.string().required(),
  cie: Joi.string().required(),
  name: Joi.string().required(),
  notes: Joi.string().allow('').allow(null),
});

const meetingInfo = {
  date: undefined,
  participants: [],
  purpose: undefined,
  challenge: undefined,
  notes: undefined,
};

const meetingInfoSchema = Joi.object({
  date: Joi.number().required(),
  participants: Joi.array(),
  purpose: Joi.string().required(),
  challenge: Joi.string().allow('').allow(null),
  notes: Joi.string().allow('').allow(null),
});

const applicationType = ['Recruiters', 'Direct'];

const globalStructure = {
  email: undefined,
  location: undefined,
  website: undefined,
  applicationType: undefined,
  recruiters: recruitersInfo,
  company,
  title: undefined,
  description: undefined,
  date: undefined,
  application: false,
  answer_receive: false,
  meeting: [],
  notes: undefined,
  cover_letter: undefined,
  offer: undefined,
  acceptedOffer: undefined,
};

const globalStructureSchema = Joi.object({
  _id: Joi.string(),
  email: Joi.string().required(),
  location: Joi.string().required(),
  website: Joi.string().allow('').allow(null),
  applicationType: Joi.string().allow('').allow(null),
  recruiters: Joi.string().allow('').allow(null),
  company: Joi.string().required(),
  title: Joi.string().required(),
  description: Joi.string().allow('').allow(null),
  date: Joi.date(),
  application: Joi.boolean(),
  answer_receive: Joi.boolean(),
  meeting: Joi.array(),
  notes: Joi.string().allow('').allow(null),
  cover_letter: Joi.string().allow('').allow(null),
  offer: Joi.string().allow('', 'Yes', 'No', 'Rejected').allow(null),
  acceptedOffer: Joi.boolean(),
});

// Extract Website list (indeed, linkedIn, etc) & Count of each & number of feedback receive.
const websiteInfoSchema = Joi.object({
  _id: Joi.string(),
  count: Joi.number(),
  answer_receive: Joi.number(),
});

const dbName = {
  cie: 'company',
  job: 'jobapplication',
  recruiters: 'recruiters',
  userCollection: 'user',
};

module.exports = {
  analyticTitleSchema,
  globalStructure,
  globalStructureSchema,
  meetingInfo,
  meetingInfoSchema,
  applicationType,
  recruitersInfo,
  recruitersInfoSchema,
  company,
  companySchema,
  gpsSchema,
  websiteInfoSchema,
  dbName,
};
