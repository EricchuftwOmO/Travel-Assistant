// Uniform error responses: { error: { code, message, details? } }

class GatewayError extends Error {
    constructor(status, code, message, details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

function sendError(res, status, code, message, details) {
    const error = { code, message };
    if (details) error.details = details;
    res.status(status).json({ error });
}

function notFound(req, res) {
    sendError(res, 404, 'NOT_FOUND', `Endpoint not found: ${req.method} ${req.path}`);
}

function errorHandler(err, req, res, next) {
    if (res.headersSent) return next(err);

    if (err instanceof GatewayError) {
        return sendError(res, err.status, err.code, err.message, err.details);
    }

    // Anything else is unexpected: log it, but never return a stack trace
    console.error(`[${req.id}] Unexpected error:`, err);
    sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
}

module.exports = { GatewayError, sendError, notFound, errorHandler };
