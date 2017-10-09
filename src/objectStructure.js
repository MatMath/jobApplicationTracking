const company = {
  name: '',
  location: '',
  gps: {},
  contact: '',
  link: '',
};

const recruitersInfo = {
  cie: '',
  name: '',
};

const meetingInfo = {
  date: '',
  participants: [],
  purpose: '',
  challenge: '',
  notes: '',
};

const applicationType = ['Recruiters', 'Direct'];

const globalStructure = {
  location: '',
  website: '',
  applicationType: '',
  recruiters: recruitersInfo,
  company,
  title: '',
  description: '',
  date: '',
  application: false,
  answer_receive: false,
  meeting: [],
  notes: '',
  cover_letter: '',
};

module.exports = {
  globalStructure,
  meetingInfo,
  applicationType,
  recruitersInfo,
  company,
};
