import { APIError, createAuthMiddleware } from 'better-auth/api';

const NAME_PATTERN = /^[a-zA-Z\s]{2,50}$/;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const validateSignUp = (body: { name?: unknown; password?: unknown }): string | null => {
  if (typeof body.name !== 'string' || !NAME_PATTERN.test(body.name.trim())) {
    return 'Name must be 2 to 50 characters and contain only letters and spaces';
  }
  if (typeof body.password !== 'string' || !PASSWORD_PATTERN.test(body.password)) {
    return 'Password must be at least 8 characters and contain an uppercase letter, a lowercase letter, a number and a special character';
  }
  return null;
};

export const signUpPolicy = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== '/sign-up/email') return;

  const error = validateSignUp(ctx.body ?? {});
  if (error) {
    throw new APIError('BAD_REQUEST', { message: error });
  }
});
