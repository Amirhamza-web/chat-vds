export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const NotFound = (msg = 'Not found') => new HttpError(404, msg, 'NOT_FOUND');
export const Forbidden = (msg = 'Forbidden') => new HttpError(403, msg, 'FORBIDDEN');
export const Unauthorized = (msg = 'Unauthorized') => new HttpError(401, msg, 'UNAUTHORIZED');
export const BadRequest = (msg = 'Bad request') => new HttpError(400, msg, 'BAD_REQUEST');
export const Conflict = (msg = 'Conflict') => new HttpError(409, msg, 'CONFLICT');
