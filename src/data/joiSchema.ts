const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
import {
  AnalyticTitle,
  Company,
  GlobalStructure,
  Gps,
  MeetingInfo,
  RecruitersInfo,
  WebsiteInfo
} from './types';

export const analyticTitleSchema: AnalyticTitle = {
  _id: Joi.string(),
  count: Joi.number(),
};

export const gpsSchema: Gps = {
  type: Joi.string(),
  geometry: {
    type: Joi.string(),
    coordinates: Joi.array().items(Joi.number()),
  },
  properties: {
    name: Joi.string(),
  },
};

export const companySchema: Company = {
  _id: Joi.objectId(),
  email: Joi.string().required(),
  name: Joi.string().required(),
  location: Joi.string().required(),
  gps: gpsSchema,
  contact: Joi.string().allow('').allow(null),
  link: Joi.string().allow('').allow(null),
};

export const recruitersInfoSchema: RecruitersInfo = {
  _id: Joi.objectId(),
  email: Joi.string().required(),
  cie: Joi.string().required(),
  name: Joi.string().required(),
  notes: Joi.string().allow('').allow(null),
};

export const meetingInfoSchema: MeetingInfo = {
  date: Joi.number().required(),
  participants: Joi.array(),
  purpose: Joi.string().required(),
  challenge: Joi.string().allow('').allow(null),
  notes: Joi.string().allow('').allow(null),
};

export const globalStructureSchema:GlobalStructure = {
  _id: Joi.objectId(),
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
};

// Extract Website list (indeed, linkedIn, etc) & Count of each & number of feedback receive.
export const websiteInfoSchema: WebsiteInfo = {
  _id: Joi.string(),
  count: Joi.number(),
  answer_receive: Joi.number(),
};

