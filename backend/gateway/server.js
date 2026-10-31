// TCSS 559 Autumn 2026
// Travel Assistant - API Gateway
// Entry point: loads the configuration and starts the gateway

const { loadConfig } = require('./src/config');
const { createApp } = require('./src/app');

const config = loadConfig();
const app = createApp(config);

const server = app.listen(config.port, () => {
    console.log(`API Gateway listening at http://localhost:${config.port}`);
    for (const [name, service] of Object.entries(config.services)) {
        console.log(`  ${name.padEnd(8)} ${service.url || '(not configured)'}`);
    }
});

// Stop cleanly when Docker stops the container
for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => server.close(() => process.exit(0)));
}
