class AppError extends Error {
  constructor(message, status = 500, code = 'internal_error', details = undefined) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'unauthorized');
    this.name = 'AuthError';
  }
}

module.exports = {
  AppError,
  AuthError
};
