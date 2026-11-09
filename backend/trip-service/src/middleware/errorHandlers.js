const ApiError = require('../helpers/ApiError');

const { codeFor } = ApiError;

const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

// Express identifies error middleware by its four parameters, so next must stay.
const errorHandler = (err, req, res, next) => {
  let { status, message } = err;
  let details;

  if (err instanceof ApiError) {
    details = err.details;
  } else if (err.type === 'entity.parse.failed') {
    message = 'Request body is not valid JSON';
  } else if (!err.expose) {
    // Unexpected failures are logged, and their details stay out of the response.
    console.error(err);
    status = 500;
    message = 'Internal server error';
  }

  // Same shape as the other services and the gateway: { error: { code, message, details } }
  res.status(status).json({ error: { code: codeFor(status), message, details } });
};

module.exports = { notFound, errorHandler };
