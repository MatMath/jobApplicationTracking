const Joi = require('joi');

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
  name: Joi.string().required(),
  location: Joi.string().required(),
  gps: {
    type: Joi.string(),
    coordinates: Joi.array().length(2),
  },
  contact: Joi.string(),
  link: Joi.string(),
};

const recruitersInfo = {
  cie: undefined,
  name: undefined,
};

const recruitersInfoSchema = {
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
  challenge: Joi.string(),
  notes: Joi.string(),
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
  location: Joi.string(),
  website: Joi.string(),
  applicationType: Joi.string(),
  recruiters: Joi.string(),
  company: Joi.string(),
  title: Joi.string(),
  description: Joi.string(),
  date: Joi.number(),
  application: Joi.boolean(),
  answer_receive: Joi.boolean(),
  meeting: Joi.array(),
  notes: Joi.string(),
  cover_letter: Joi.string(),
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
