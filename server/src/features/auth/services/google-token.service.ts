import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client();

export interface VerifiedGoogleUser {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

/**
 * Checks a Google ID token's signature, expiry, issuer and audience, and returns the identity
 * Google vouches for. Returns null when the token can't be trusted for any reason.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<VerifiedGoogleUser | null> {
  const audience = [process.env.GOOGLE_MOBILE_CLIENT_ID, process.env.GOOGLE_CLIENT_ID].filter(
    (clientId): clientId is string => Boolean(clientId)
  );

  // Without an audience, a token issued to any other app would pass: refuse instead.
  if (audience.length === 0) {
    console.error('Google token check skipped: no GOOGLE_MOBILE_CLIENT_ID or GOOGLE_CLIENT_ID set');
    return null;
  }

  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience });
    const payload = ticket.getPayload();

    if (!payload?.email || !payload.email_verified) return null;

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
  } catch (error) {
    console.error('Google token verification failed:', (error as Error).message);
    return null;
  }
}
