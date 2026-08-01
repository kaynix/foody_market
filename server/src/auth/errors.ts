import { AppHttpError } from '../http/errors';

export class AuthError extends AppHttpError {
  constructor(
    message: string,
    statusCode: number,
    code: string,
  ) {
    super(message, statusCode, code);
    this.name = 'AuthError';
  }
}
