import {
  Company,
  DbName,
  MeetingInfo,
  GlobalStructure,
  RecruitersInfo
} from './types'

const company:Company = {
  _id: undefined,
  name: null,
  email: null,
  location: null,
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
  contact: null,
  link: null,
};

export const recruitersInfo:RecruitersInfo  = {
  _id: undefined,
  cie: '',
  email: '',
  name: '',
  notes: undefined,
};

export const globalStructure: GlobalStructure = {
  _id: undefined,
  email: '',
  location: '',
  website: '',
  applicationType: null,
  recruiters: '',
  company: '',
  title: '',
  description: '',
  date: undefined,
  application: false,
  answer_receive: false,
  meeting: [],
  notes: '',
  cover_letter: '',
  offer: null,
  acceptedOffer: null,
};

export const meetingInfo:MeetingInfo = {
  date: undefined,
  participants: [],
  purpose: null,
  challenge: null,
  notes: null,
};

export const dbName: DbName = {
  cie: 'company',
  job: 'jobapplication',
  recruiters: 'recruiters',
  userCollection: 'user',
};