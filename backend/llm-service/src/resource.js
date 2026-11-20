// The travel advice resource. POST /api/advice fills "content" with an LLM when it is omitted (see llm.js).

const TOPICS = ['general', 'packing', 'food', 'safety', 'budget', 'itinerary'];

module.exports = {
    name: 'Advice',
    tag: 'Advice',
    path: '/api/advice',
    table: 'advice',
    dbName: 'llm_db',
    description:
        'Saved travel advice. When a new advice record is created without "content", the LLM service asks the ' +
        'language model to answer the "prompt" and stores the answer. Without an API key it stores a placeholder ' +
        'answer (source "stub") so the service still works offline.',
    fields: {
        user_id: { type: 'string', required: true, maxLength: 50, example: 'u1' },
        trip_id: { type: 'integer', min: 1, description: 'Trip this advice is about (optional)', example: 1 },
        topic: { type: 'enum', values: TOPICS, default: 'general', example: 'packing' },
        prompt: { type: 'text', required: true, maxLength: 1000, description: 'The question to ask the LLM', example: 'What should I pack for Tokyo in December?' },
        content: { type: 'text', description: 'The answer. Leave out on create to have the LLM write it.', example: 'Pack layers: it is cold but dry. Bring a warm coat, comfortable shoes, and a Suica card.' },
        model: { type: 'string', readOnly: true, description: 'Model that wrote the content (set by the service)' },
        source: { type: 'enum', values: ['llm', 'stub', 'user'], readOnly: true, description: 'llm = model answer, stub = placeholder (no API key), user = content supplied by the caller' },
    },
    filters: [
        { param: 'userId', column: 'user_id', op: 'eq', description: "User's ID" },
        { param: 'tripId', column: 'trip_id', op: 'eq', type: 'integer', description: 'Trip ID' },
        { param: 'topic', column: 'topic', op: 'eq', type: 'enum', values: TOPICS, description: 'Advice topic' },
    ],
    sortable: ['created_at'],
    seed: [
        { user_id: 'u1', trip_id: 1, topic: 'packing', prompt: 'What should I pack for Tokyo in December?', content: 'Pack layers: days are cool and dry, nights near freezing. Bring a warm coat, comfortable walking shoes, and a Suica or Pasmo card for trains.', model: 'sample', source: 'user' },
        { user_id: 'u1', trip_id: 2, topic: 'food', prompt: 'Where should I eat on a Seattle weekend?', content: 'Start with Pike Place Market for breakfast, try Seattle-style teriyaki for lunch, and book a seafood dinner on the waterfront.', model: 'sample', source: 'user' },
    ],
};
