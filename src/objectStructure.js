const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);

const company = {
  name: undefined,
  location: undefined,
  gps: {
    type: undefined,
    coordinates: [0, 0],
  },
  contact: undefined,
  link: undefined,
};

const companySchema = {
  _id: Joi.objectId(),
  name: Joi.string().required(),
  location: Joi.string().required(),
  gps: {
    type: Joi.string().allow(''),
    coordinates: Joi.array().length(2),
  },
  contact: Joi.string().allow(''),
  link: Joi.string().allow(''),
};

const recruitersInfo = {
  cie: undefined,
  name: undefined,
};

const recruitersInfoSchema = {
  _id: Joi.objectId(),
  cie: Joi.string().required(),
  name: Joi.string().required(),
};

const meetingInfo = {
  date: undefined,
  participants: [],
  purpose: undefined,
  challenge: undefined,
  notes: undefined,
};

const meetingInfoSchema = {
  date: Joi.number().required(),
  participants: Joi.array(),
  purpose: Joi.string().required(),
  challenge: Joi.string().allow(''),
  notes: Joi.string().allow(''),
};

const applicationType = ['Recruiters', 'Direct'];

const globalStructure = {
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
};

const globalStructureSchema = {
  _id: Joi.objectId(),
  location: Joi.string().required(),
  website: Joi.string().allow(''),
  applicationType: Joi.string().allow(''),
  recruiters: Joi.string().allow(''),
  company: Joi.string().required(),
  title: Joi.string().required(),
  description: Joi.string().allow(''),
  date: Joi.date(),
  application: Joi.boolean(),
  answer_receive: Joi.boolean(),
  meeting: Joi.array(),
  notes: Joi.string().allow(''),
  cover_letter: Joi.string().allow(''),
};

const dbName = {
  cie: 'company',
  job: 'jobapplication',
  recruiters: 'recruiters',
};

module.exports = {
  globalStructure,
  globalStructureSchema,
  meetingInfo,
  meetingInfoSchema,
  applicationType,
  recruitersInfo,
  recruitersInfoSchema,
  company,
  companySchema,
  dbName,
};
