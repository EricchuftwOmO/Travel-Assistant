// Creates the GraphQL endpoint (GraphQL Yoga) served by the gateway at /graphql and /api/graphql.
// Resolvers call the REST services, so the gateway still has no database or business logic,
// and it never reads a token itself: the user service says who the caller is.

const { readFileSync } = require('node:fs');
const path = require('node:path');
const { createSchema, createYoga } = require('graphql-yoga');
const { resolvers } = require('./resolvers');
const { userIdLoader } = require('./upstream');

// A query that never ran (it does not parse, or does not fit the schema) has errors and no `data` at all.
// That is a client error: HTTP 400. A field that fails while running stays 200 with `errors`, as GraphQL expects.
// (Yoga answers 200 to these for plain application/json requests, so the status is set on the whole result.)
const clientErrorStatus = {
    onResultProcess({ result, setResult }) {
        if (Array.isArray(result) || !result.errors?.length || 'data' in result) return;
        setResult({ ...result, extensions: { ...result.extensions, http: { status: 400 } } });
    },
};

const typeDefs = readFileSync(path.join(__dirname, 'schema.graphql'), 'utf8');

function createGraphql(config) {
    return createYoga({
        schema: createSchema({ typeDefs, resolvers }),
        plugins: [clientErrorStatus],
        graphqlEndpoint: '*',   // Express mounts this under both /graphql and /api/graphql
        graphiql: { title: 'Travel Assistant: GraphiQL' },
        landingPage: false,
        cors: false,            // the gateway's own CORS middleware already runs
        logging: 'warn',
        context: ({ req }) => {
            const authorization = req.get('Authorization') || '';
            return { config, requestId: req.id, authorization, userId: userIdLoader(config, authorization, req.id) };
        },
    });
}

module.exports = { createGraphql };
