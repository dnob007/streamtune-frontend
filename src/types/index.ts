export interface User {
  id:            string;
  username:      string;
  email:         string;
  displayName:   string;
  role:          'viewer' | 'creator' | 'admin';
  creditBalance: number;
  isVerified:    boolean;
  avatarUrl?:    string;
}

export interface Channel {
  id:           string;
  slug:         string;
  name:         string;
  description:  string;
  descLong?:    string;
  icon:         string;
  accentColor:  string;
  topics:       string[];
  plan:         'free' | 'creator' | 'pro';
  status:       'live' | 'paused' | 'offline';
  followerCount:number;
  timezone:     string;
  owner?:       { username: string; displayName: string; avatarUrl?: string };
  viewers?:     number;
}

export interface Video {
  id:          string;
  ytId?:       string;
  title:       string;
  artist?:     string;
  durationSec: number;
  source:      'youtube' | 'upload';
  thumbnail?:  string;
}

export interface ScheduleDay {
  id?:          string;
  dayOfWeek:    number;
  videos:       Video[];
  shuffle:      boolean;
  loop:         boolean;
  crossfadeSec: number;
  totalDuration:number;
}

export interface LiveState {
  ytId:          string;
  frameAt:       number;
  totalDuration: number;
  title:         string;
  artist:        string;
  videoIndex:    number;
  totalVideos:   number;
  nextVideo?:    string;
  viewers?:      number;
}

export interface ChatMessage {
  id:        string;
  userId:    string;
  username:  string;
  body:      string;
  type:      'text' | 'reward' | 'system';
  creditAmt?:number;
  createdAt: string;
}

export interface CreditPack {
  id:       string;
  credits:  number;
  usdCents: number;
}

export interface AuthResponse {
  user:         User;
  accessToken:  string;
  refreshToken: string;
}
