// Generic CRUD routes, table and validation built from src/resource.js.

const express = require('express');
const { badRequest, notFound } = require('./errors');

const SQL_TYPES = {
    string: 'TEXT', text: 'TEXT', enum: 'TEXT', integer: 'INTEGER',
    number: 'NUMERIC(10,2)', boolean: 'BOOLEAN', datetime: 'TIMESTAMPTZ',
};

const writableNames = (resource) =>
    Object.entries(resource.fields).filter(([, def]) => !def.readOnly).map(([name]) => name);

async function initTable(pool, resource) {
    const columns = Object.entries(resource.fields).map(([name, def]) => {
        let sql = `${name} ${SQL_TYPES[def.type]}`;
        if (def.required) sql += ' NOT NULL';
        if (def.default !== undefined) sql += ` DEFAULT ${typeof def.default === 'string' ? `'${def.default}'` : def.default}`;
        return sql;
    });
    await pool.query(
        `CREATE TABLE IF NOT EXISTS ${resource.table} (
           id SERIAL PRIMARY KEY,
           ${columns.join(',\n           ')},
           created_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`);

    const { rows } = await pool.query(`SELECT COUNT(*) AS n FROM ${resource.table}`);
    if (rows[0].n > 0 || !resource.seed?.length) return;
    for (const row of resource.seed) await insert(pool, resource, row);
    console.log(`[db] seeded ${resource.seed.length} rows into ${resource.table}`);
}

async function insert(pool, resource, values) {
    const names = Object.keys(values);
    const sql = names.length
        ? `INSERT INTO ${resource.table} (${names.join(', ')}) VALUES (${names.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`
        : `INSERT INTO ${resource.table} DEFAULT VALUES RETURNING *`;
    return (await pool.query(sql, names.map((n) => values[n]))).rows[0];
}

function checkValue(def, value) {
    switch (def.type) {
        case 'string':
        case 'text': {
            if (typeof value !== 'string') return ['must be a string'];
            const text = value.trim();
            if (!text) return ['must not be empty'];
            const max = def.maxLength || (def.type === 'text' ? 5000 : 200);
            if (text.length > max) return [`must be at most ${max} characters`];
            return [null, text];
        }
        case 'integer':
            if (!Number.isInteger(value)) return ['must be an integer'];
            break;
        case 'number':
            if (typeof value !== 'number' || !Number.isFinite(value)) return ['must be a number'];
            break;
        case 'boolean':
            return typeof value === 'boolean' ? [null, value] : ['must be true or false'];
        case 'datetime': {
            const date = typeof value === 'string' ? new Date(value) : null;
            if (!date || Number.isNaN(date.getTime())) return ['must be an ISO 8601 date-time, e.g. 2026-12-01T08:30:00Z'];
            return [null, date.toISOString()];
        }
        case 'enum':
            return def.values.includes(value) ? [null, value] : [`must be one of: ${def.values.join(', ')}`];
    }
    if (def.min !== undefined && value < def.min) return [`must be at least ${def.min}`];
    if (def.max !== undefined && value > def.max) return [`must be at most ${def.max}`];
    return [null, value];
}

// Returns { values } to write, or throws 400 listing every problem.
function validateBody(resource, body, mode) {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        throw badRequest('Request body must be a JSON object');
    }
    const problems = [];
    const values = {};
    const writable = writableNames(resource);

    for (const key of Object.keys(body)) {
        if (!writable.includes(key)) problems.push({ field: key, message: 'is not a writable field' });
    }

    for (const name of writable) {
        const def = resource.fields[name];
        const given = body[name];

        if (given === undefined) {
            if (def.required && mode !== 'patch') problems.push({ field: name, message: 'is required' });
            // PUT replaces everything: an omitted optional field goes back to its default (or null)
            if (mode === 'replace' && !def.required) values[name] = def.default ?? null;
        } else if (given === null) {
            if (def.required) problems.push({ field: name, message: 'must not be null' });
            else values[name] = null;
        } else {
            const [error, clean] = checkValue(def, given);
            if (error) problems.push({ field: name, message: error });
            else values[name] = clean;
        }
    }

    if (problems.length) throw badRequest('Validation failed', problems);
    if (mode === 'patch' && Object.keys(values).length === 0) throw badRequest('Send at least one field to update');
    return values;
}

function parseId(raw) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1) throw badRequest("Path parameter 'id' must be a positive integer");
    return id;
}

function parseIntQuery(query, name, { min, max, fallback }) {
    if (query[name] === undefined) return fallback;
    const n = Number(query[name]);
    if (!Number.isInteger(n) || n < min || n > max) throw badRequest(`Query parameter '${name}' must be an integer from ${min} to ${max}`);
    return n;
}

function buildWhere(resource, query) {
    const clauses = [];
    const params = [];
    for (const filter of resource.filters || []) {
        const raw = query[filter.param];
        if (raw === undefined) continue;

        let value = raw;
        if (filter.type === 'number' || filter.type === 'integer') {
            value = Number(raw);
            if (!Number.isFinite(value)) throw badRequest(`Query parameter '${filter.param}' must be a number`);
        } else if (filter.type === 'boolean') {
            if (!['true', 'false'].includes(raw)) throw badRequest(`Query parameter '${filter.param}' must be 'true' or 'false'`);
            value = raw === 'true';
        } else if (filter.type === 'date' && Number.isNaN(Date.parse(raw))) {
            throw badRequest(`Query parameter '${filter.param}' must be a date like 2026-12-01`);
        } else if (filter.type === 'enum' && !filter.values.includes(raw)) {
            throw badRequest(`Query parameter '${filter.param}' must be one of: ${filter.values.join(', ')}`);
        }
        if (typeof value === 'object') continue; // repeated parameter (?city=a&city=b): ignore

        params.push(filter.op === 'contains' ? `%${value}%` : value);
        const p = `$${params.length}`;
        const col = filter.column;
        clauses.push({
            eq: `${col} = ${p}`,
            ieq: `LOWER(${col}) = LOWER(${p})`,
            contains: `${col} ILIKE ${p}`,
            lte: `${col} <= ${p}`,
            gte: `${col} >= ${p}`,
            date: `${col}::date = ${p}::date`,
        }[filter.op]);
    }
    return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

// hooks.beforeCreate(values) may be async and may add or change values
function createCrudRouter(resource, pool, cache, hooks = {}) {
    const router = express.Router();
    const sortable = ['id', ...(resource.sortable || [])];

    const cached = (handler) => async (req, res) => {
        const hit = await cache.get(req.originalUrl);
        if (hit) {
            res.set('X-Cache', 'HIT');
            if (hit.total !== undefined) res.set('X-Total-Count', String(hit.total));
            return res.status(200).json(hit);
        }
        res.set('X-Cache', 'MISS');
        const body = await handler(req, res);
        await cache.set(req.originalUrl, body);
        res.status(200).json(body);
    };

    async function findOrFail(id) {
        const { rows } = await pool.query(`SELECT * FROM ${resource.table} WHERE id = $1`, [id]);
        if (!rows[0]) throw notFound(`${resource.name} ${id} not found`);
        return rows[0];
    }

    router.get('/', cached(async (req, res) => {
        const { where, params } = buildWhere(resource, req.query);
        const sort = req.query.sort ?? 'id';
        if (!sortable.includes(sort)) throw badRequest(`Query parameter 'sort' must be one of: ${sortable.join(', ')}`);
        const order = req.query.order ?? 'asc';
        if (!['asc', 'desc'].includes(order)) throw badRequest("Query parameter 'order' must be 'asc' or 'desc'");
        const limit = parseIntQuery(req.query, 'limit', { min: 1, max: 100, fallback: 50 });
        const offset = parseIntQuery(req.query, 'offset', { min: 0, max: Number.MAX_SAFE_INTEGER, fallback: 0 });

        const { rows: [{ n: total }] } = await pool.query(`SELECT COUNT(*) AS n FROM ${resource.table} ${where}`, params);
        const { rows } = await pool.query(
            `SELECT * FROM ${resource.table} ${where} ORDER BY ${sort} ${order.toUpperCase()}, id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limit, offset]);
        res.set('X-Total-Count', String(total));
        return { count: rows.length, total, data: rows };
    }));

    router.get('/:id', cached(async (req) => findOrFail(parseId(req.params.id))));

    router.post('/', async (req, res) => {
        const values = validateBody(resource, req.body, 'create');
        if (hooks.beforeCreate) await hooks.beforeCreate(values);
        const row = await insert(pool, resource, values);
        await cache.clear();
        res.status(201).location(`${resource.path}/${row.id}`).json(row);
    });

    async function update(req, res, mode) {
        const id = parseId(req.params.id);
        await findOrFail(id);
        const values = validateBody(resource, req.body, mode);
        const names = Object.keys(values);
        const sets = names.map((name, i) => `${name} = $${i + 1}`).join(', ');
        const { rows } = await pool.query(
            `UPDATE ${resource.table} SET ${sets} WHERE id = $${names.length + 1} RETURNING *`,
            [...names.map((n) => values[n]), id]);
        await cache.clear();
        res.status(200).json(rows[0]);
    }
    router.put('/:id', (req, res) => update(req, res, 'replace'));
    router.patch('/:id', (req, res) => update(req, res, 'patch'));

    router.delete('/:id', async (req, res) => {
        const id = parseId(req.params.id);
        const { rowCount } = await pool.query(`DELETE FROM ${resource.table} WHERE id = $1`, [id]);
        if (!rowCount) throw notFound(`${resource.name} ${id} not found`);
        await cache.clear();
        res.status(204).end();
    });

    return router;
}

module.exports = { initTable, createCrudRouter };
