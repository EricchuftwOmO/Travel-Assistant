// The GraphQL API: POST /graphql (also reachable through the gateway as /api/graphql).
// Requests carry { query, variables, operationName } as JSON.

const { buildSchema, graphql, GraphQLError } = require('graphql');
const ApiError = require('./helpers/ApiError');
const accounts = require('./accounts');

const typeDefs = /* GraphQL */ `
  "A calendar date without a time, e.g. 2000-05-10 (YYYY-MM-DD)."
  scalar Date

  "The user's gender, if they choose to provide it."
  enum Gender {
    MALE
    FEMALE
    NON_BINARY
    OTHER
    PREFER_NOT_TO_SAY
  }

  "The user's preferred travel budget category."
  enum BudgetLevel {
    BUDGET
    MODERATE
    LUXURY
  }

  "Types of activities the user enjoys when traveling."
  enum TravelStyle {
    ADVENTURE
    NATURE
    CULTURE
    FOOD
    RELAXATION
  }

  "A Travel Assistant account and profile. The password is never returned."
  type User {
    id: ID!
    firstName: String!
    lastName: String!
    "First and last name together, e.g. Chun-Wei Chu."
    name: String!
    gender: Gender
    dateOfBirth: Date
    phone: String
    country: String
    email: String!
    createdAt: String!
    languageSettings: LanguageSettings!
    travelPreferences: TravelPreferences!
  }

  "Settings displayed in the Language & Timezone tab."
  type LanguageSettings {
    "e.g. en, zh-TW"
    language: String!
    "An IANA time zone, e.g. America/Los_Angeles"
    timezone: String!
  }

  "Settings displayed in the Travel Preferences tab."
  type TravelPreferences {
    budgetLevel: BudgetLevel
    travelStyles: [TravelStyle!]!
  }

  "A login token (JWT, valid for 1 hour) and the account it belongs to."
  type AuthPayload {
    user: User!
    token: String!
  }

  "Give either name (split into first and last name) or firstName and lastName."
  input RegisterInput {
    name: String
    firstName: String
    lastName: String
    email: String!
    "At least 8 characters."
    password: String!
  }

  input ProfileInput {
    name: String!
    email: String!
  }

  "Fields that can be changed in the Basic Information tab. Omitted fields stay as they are; null clears an optional one."
  input UpdateBasicInfoInput {
    firstName: String
    lastName: String
    gender: Gender
    dateOfBirth: Date
    phone: String
    country: String
  }

  "Fields that can be changed in the Language & Timezone tab."
  input UpdateLanguageSettingsInput {
    language: String
    timezone: String
  }

  "Fields that can be changed in the Travel Preferences tab."
  input UpdateTravelPreferencesInput {
    budgetLevel: BudgetLevel
    travelStyles: [TravelStyle!]
  }

  type Query {
    "The signed-in user (Authorization: Bearer <token>), or null without a valid token."
    me: User
    "Language and timezone settings (Language & Timezone tab)."
    myLanguageSettings: LanguageSettings
    "Travel preferences (Travel Preferences tab)."
    myTravelPreferences: TravelPreferences
  }

  type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    "Save the Basic Information tab. Email changes need a separate verification step."
    updateBasicInfo(input: UpdateBasicInfoInput!): User!
    "Save the Language & Timezone tab."
    updateLanguageSettings(input: UpdateLanguageSettingsInput!): LanguageSettings!
    "Save the Travel Preferences tab."
    updateTravelPreferences(input: UpdateTravelPreferencesInput!): TravelPreferences!
    "Replaces the signed-in user's name and email (older, simpler update)."
    updateMe(input: ProfileInput!): User!
    "Deletes the signed-in user's trips and then the account."
    deleteMe: Boolean!
  }
`;

const schema = buildSchema(typeDefs);

// GraphQL error codes, in the style used by most GraphQL servers.
const GRAPHQL_CODES = {
  400: 'BAD_USER_INPUT',
  401: 'UNAUTHENTICATED',
  409: 'CONFLICT',
  502: 'UPSTREAM_UNAVAILABLE',
};

const requireUser = (context) => {
  if (!context.user) throw new ApiError(401, 'A valid bearer token is required');
  return context.user;
};

// A user row as a GraphQL User. Nested fields can be functions: the default resolver calls them,
// so travel preferences are only read from the database when a query asks for them.
const toUser = (row) =>
  row && {
    ...row,
    languageSettings: { language: row.language, timezone: row.timezone },
    travelPreferences: () => accounts.getTravelPreferences(row.id),
  };

const withUser = async (promise) => {
  const result = await promise;
  return { ...result, user: toUser(result.user) };
};

// With buildSchema, each root field is resolved by the function of the same name: (args, context).
const rootValue = {
  me: (args, context) => toUser(context.user),
  myLanguageSettings: (args, context) =>
    context.user && { language: context.user.language, timezone: context.user.timezone },
  myTravelPreferences: (args, context) => context.user && accounts.getTravelPreferences(context.user.id),

  register: ({ input }) => withUser(accounts.register(input)),
  login: ({ email, password }) => withUser(accounts.login({ email, password })),
  updateBasicInfo: async ({ input }, context) =>
    toUser(await accounts.updateBasicInfo(requireUser(context).id, input)),
  updateLanguageSettings: ({ input }, context) =>
    accounts.updateLanguageSettings(requireUser(context).id, input),
  updateTravelPreferences: ({ input }, context) =>
    accounts.updateTravelPreferences(requireUser(context).id, input),
  updateMe: async ({ input }, context) => toUser(await accounts.updateProfile(requireUser(context).id, input)),
  deleteMe: async (args, context) => {
    await accounts.deleteAccount(requireUser(context).id, context.authorization);
    return true;
  },
};

// An ApiError becomes { message, extensions: { code, status, details } }; anything
// unexpected is logged and reported without its internals.
const formatError = (error) => {
  const original = error.originalError;
  if (original instanceof ApiError) {
    return {
      message: original.message,
      path: error.path,
      extensions: {
        code: GRAPHQL_CODES[original.status] || original.code,
        status: original.status,
        ...(original.details ? { details: original.details } : {}),
      },
    };
  }
  if (original) {
    console.error(original);
    return { message: 'Internal server error', path: error.path, extensions: { code: 'INTERNAL_SERVER_ERROR' } };
  }
  // A syntax or validation error in the query itself
  return { message: error.message, locations: error.locations, extensions: { code: 'GRAPHQL_VALIDATION_FAILED' } };
};

const graphqlHandler = async (req, res) => {
  const { query, variables, operationName } = req.body || {};
  if (typeof query !== 'string' || query.trim() === '') {
    return res.status(400).json({ errors: [{ message: 'Request body must contain a "query" string', extensions: { code: 'BAD_REQUEST' } }] });
  }
  if (variables != null && (typeof variables !== 'object' || Array.isArray(variables))) {
    return res.status(400).json({ errors: [{ message: '"variables" must be a JSON object', extensions: { code: 'BAD_REQUEST' } }] });
  }

  const authorization = req.get('Authorization');
  const contextValue = { user: await accounts.userFromHeader(authorization), authorization };

  const result = await graphql({
    schema,
    source: query,
    rootValue,
    contextValue,
    variableValues: variables || undefined,
    operationName: typeof operationName === 'string' ? operationName : undefined,
  });

  const body = { data: result.data };
  if (result.errors) body.errors = result.errors.map(formatError);
  // A query that never ran (no data at all) is a client error; a failed field is still 200, as GraphQL expects.
  res.status(result.data === undefined ? 400 : 200).json(body);
};

module.exports = { graphqlHandler, typeDefs, schema };
