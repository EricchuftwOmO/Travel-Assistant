// Error type; responses use { error: { code, message, details } }, like the gateway.

class HttpError extends Error {
    constructor(status, code, message, details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

const badRequest = (message, details) => new HttpError(400, 'BAD_REQUEST', message, details);
const notFound = (message) => new HttpError(404, 'NOT_FOUND', message);

module.exports = { HttpError, badRequest, notFound };
