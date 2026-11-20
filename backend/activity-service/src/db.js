// PostgreSQL connection. Creates the service's own database on first start if it is missing.

const { Pool, types } = require('pg');

// pg returns NUMERIC and COUNT as strings; the API wants real numbers
types.setTypeParser(types.builtins.NUMERIC, Number.parseFloat);
types.setTypeParser(types.builtins.INT8, Number);

async function connect(dbName) {
    const base = {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    };

    const admin = new Pool({ ...base, database: 'postgres', max: 1 });
    try {
        const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
        if (!rowCount) await admin.query(`CREATE DATABASE "${dbName}"`);
    } finally {
        await admin.end();
    }

    return new Pool({ ...base, database: dbName });
}

module.exports = { connect };
