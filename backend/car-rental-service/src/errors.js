// TCSS 559 Autumn 2026
// Travel Assistant - shared error type. Every error leaves the service in the
// same JSON shape the gateway uses: { error: { code, message, details } }

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
