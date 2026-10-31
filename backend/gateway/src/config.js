// TCSS 559 Autumn 2026
// Travel Assistant - API Gateway
// Configuration read from environment variables (see .env.example)

// Read a positive integer from the environment, or use the default
function intFromEnv(name, fallback) {
    const value = Number.parseInt(process.env[name], 10);
    return Number.isInteger(value) && value > 0 ? value : fallback;
}

function loadConfig() {
    const defaultTimeoutMs = intFromEnv('UPSTREAM_TIMEOUT_MS', 5000);

    return {
        port: intFromEnv('PORT', 8080),

        // Allowed browser origins for CORS, comma-separated ("*" allows any origin)
        corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
            .split(',')
            .map((origin) => origin.trim())
            .filter(Boolean),

        // Path each service exposes for its own health check
        healthPath: process.env.SERVICE_HEALTH_PATH || '/health',
        healthTimeoutMs: intFromEnv('HEALTH_TIMEOUT_MS', 2000),

        logRequests: process.env.LOG_REQUESTS !== 'false',

        // Services behind the gateway. A service with no URL is not routed
        // (the AI Planner is a stretch goal, so it has no default URL).
        services: {
            trip: {
                url: process.env.TRIP_SERVICE_URL || 'http://localhost:3001',
                timeoutMs: defaultTimeoutMs,
            },
            search: {
                url: process.env.SEARCH_SERVICE_URL || 'http://localhost:3002',
                timeoutMs: defaultTimeoutMs,
            },
            budget: {
                url: process.env.BUDGET_SERVICE_URL || 'http://localhost:3003',
                timeoutMs: defaultTimeoutMs,
            },
            planner: {
                url: process.env.PLANNER_SERVICE_URL || '',
                timeoutMs: intFromEnv('PLANNER_TIMEOUT_MS', 60000),
            },
        },
    };
}

module.exports = { loadConfig };
