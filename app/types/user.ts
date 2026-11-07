/** The signed-in user, as returned by GET /api/profile. */
export interface User {
  userid: number;
  name: string;
  username: string;
  email: string;
  bio: string;
  profilepic: string;
  verified: boolean;
  twoFactorEnabled?: boolean;
  /** False for users who only sign in with Google or a passkey. */
  hasPassword?: boolean;
  isAdmin?: boolean;
  expoPushToken?: string;
  favoriteGenres?: string[];
}
