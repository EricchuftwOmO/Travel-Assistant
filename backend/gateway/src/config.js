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

        // Shared with the trip service, which signs the tokens
        jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me',

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
            flight: {
                url: process.env.FLIGHT_SERVICE_URL || 'http://localhost:3004',
                timeoutMs: defaultTimeoutMs,
            },
            hotel: {
                url: process.env.HOTEL_SERVICE_URL || 'http://localhost:3005',
                timeoutMs: defaultTimeoutMs,
            },
            carRental: {
                url: process.env.CAR_RENTAL_SERVICE_URL || 'http://localhost:3006',
                timeoutMs: defaultTimeoutMs,
            },
            // The LLM Service waits on a language model, so it gets a longer timeout
            llm: {
                url: process.env.LLM_SERVICE_URL || 'http://localhost:3008',
                timeoutMs: intFromEnv('LLM_TIMEOUT_MS', 40000),
            },
            planner: {
                url: process.env.PLANNER_SERVICE_URL || '',
                timeoutMs: intFromEnv('PLANNER_TIMEOUT_MS', 60000),
            },
        },
    };
}

module.exports = { loadConfig };
