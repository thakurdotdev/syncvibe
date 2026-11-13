export type ChatErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'GONE'
  | 'UNAVAILABLE'
  | 'INTERNAL';

const STATUS: Record<ChatErrorCode, number> = {
  UNAUTHENTICATED: 401,
  INVALID: 400,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  RATE_LIMITED: 429,
  // An upload that expired or was removed: the device uploads the file again.
  GONE: 410,
  UNAVAILABLE: 503,
  INTERNAL: 500,
};

/** An error whose message is safe to show to the person who caused it. */
export class ChatError extends Error {
  readonly code: ChatErrorCode;
  readonly status: number;

  constructor(code: ChatErrorCode, message: string) {
    super(message);
    this.name = 'ChatError';
    this.code = code;
    this.status = STATUS[code];
  }
}

export const invalid = (message: string) => new ChatError('INVALID', message);
// Also the answer for a conversation you aren't in, so ids can't be probed.
export const notFound = (what = 'Conversation') => new ChatError('NOT_FOUND', `${what} not found`);
