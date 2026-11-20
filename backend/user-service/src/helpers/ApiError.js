const { STATUS_CODES } = require('http');

// Error codes shared with the other Travel Assistant services and the gateway.
const CODES = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  500: 'INTERNAL_ERROR',
};

// A machine-readable code for a status, e.g. 413 -> PAYLOAD_TOO_LARGE.
const codeFor = (status) =>
  CODES[status] || (STATUS_CODES[status] || 'Error').toUpperCase().replace(/\W+/g, '_');

// An expected failure that the error middleware turns into an HTTP response.
class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.code = codeFor(status);
    this.details = details;
  }
}

module.exports = ApiError;
module.exports.codeFor = codeFor;
