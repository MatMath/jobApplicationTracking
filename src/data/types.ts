
export interface AnalyticTitle {
  _id: string | undefined,
  count: number,
}

export type ApplicationType =  'Recruiters' | 'Direct'

export interface Company {
  _id: string | undefined,
  email: string | null,
  name: string | null,
  location: string | null,
  gps: Gps,
  contact?: string | null,
  link?: string | null,
};

export interface DbName {
  cie: string,
  job: string,
  recruiters: string,
  userCollection: string,
}

type offer = null | 'Yes' | 'No' | 'Rejected';
export interface GlobalStructure {
  _id: string | undefined,
  email: string | null,
  location: string | null,
  website: string | null,
  applicationType: ApplicationType | null,
  recruiters: string | null,
  company: string,
  title: string,
  description: string | null,
  date: Date | undefined,
  application: boolean,
  answer_receive: boolean,
  meeting: MeetingInfo[] | [],
  notes: string | null,
  cover_letter: string | null,
  offer: offer,
  acceptedOffer: boolean | null,
};

export interface Gps {
  type: string,
  geometry: {
    type: string,
    coordinates: number[],
  },
  properties: {
    name: string,
  },
}

export interface MeetingInfo {
  date: number | undefined,
  participants: string[],
  purpose: string | null,
  challenge: string | null,
  notes: string | null,
};

export interface RecruitersInfo {
  _id: string | undefined,
  email: string,
  cie: string,
  name: string,
  notes?: string,
};

export interface User {
  provider: string, // ex: 'google'
  displayName: string,
  email:string,
  gender:string,
}

export interface WebsiteInfo {
  _id: string | undefined,
  count: number,
  answer_receive: number, // Number time we get an answer back from website
}