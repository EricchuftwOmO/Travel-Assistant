// Combined health check of every configured service.

async function checkService(name, url, healthPath, timeoutMs) {
    const start = Date.now();
    try {
        const response = await fetch(new URL(healthPath, url), {
            signal: AbortSignal.timeout(timeoutMs),
        });
        return {
            name,
            status: response.ok ? 'up' : 'down',
            httpStatus: response.status,
            latencyMs: Date.now() - start,
        };
    } catch (err) {
        const reason = err.name === 'TimeoutError' ? 'timeout' : 'unreachable';
        return { name, status: 'down', reason, latencyMs: Date.now() - start };
    }
}

function healthHandler(config) {
    return async function health(req, res) {
        const services = Object.entries(config.services).filter(([, service]) => service.url);
        const results = await Promise.all(services.map(([name, service]) =>
            checkService(name, service.url, config.healthPath, config.healthTimeoutMs)));

        const allUp = results.every((result) => result.status === 'up');
        const body = { status: allUp ? 'ok' : 'degraded', services: {} };
        for (const { name, ...result } of results) body.services[name] = result;

        res.status(allUp ? 200 : 503).json(body);
    };
}

module.exports = { healthHandler };
