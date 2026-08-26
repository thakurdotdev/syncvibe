export interface User {
  userid: number;
  name: string;
  username: string;
  email: string;
  bio: string;
  profilepic: string;
  verified: boolean;
  logintype: 'EMAILPASSWORD' | 'GOOGLE' | 'GUEST';
  isDeleted: boolean;
  passkeyEnabled: boolean;
  lastPasskeyLogin?: string;
  passKeyChallenge?: string;
  challengeExpiry?: string;
  expoPushToken?: string;
  favoriteGenres?: string[];
}
