const Joi = require('joi');

export const gpsSchema = Joi.object({
  type: Joi.string(),
  geometry: {
    type: Joi.string(),
    coordinates: Joi.array().items(Joi.number()),
  },
  properties: {
    name: Joi.string(),
  },
});

export const analyticTitleSchema = Joi.object({
  _id: Joi.string(),
  count: Joi.number(),
});

export const companySchema = Joi.object({
  _id: Joi.string(),
  email: Joi.string().required(),
  name: Joi.string().required(),
  location: Joi.string().required(),
  gps: gpsSchema,
  contact: Joi.string().allow('').allow(null),
  link: Joi.string().allow('').allow(null),
});

export const recruitersInfoSchema = Joi.object({
  _id: Joi.string(),
  email: Joi.string().required(),
  cie: Joi.string().required(),
  name: Joi.string().required(),
  notes: Joi.string().allow('').allow(null),
});

export const meetingInfoSchema = Joi.object({
  date: Joi.number().required(),
  participants: Joi.array(),
  purpose: Joi.string().required(),
  challenge: Joi.string().allow('').allow(null),
  notes: Joi.string().allow('').allow(null),
});

export const globalStructureSchema = Joi.object({
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
export const websiteInfoSchema = Joi.object({
  _id: Joi.string(),
  count: Joi.number(),
  answer_receive: Joi.number(),
});
