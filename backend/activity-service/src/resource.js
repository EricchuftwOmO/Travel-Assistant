// The activity resource: fields, filters and sample data.

const CATEGORIES = ['sightseeing', 'food', 'outdoors', 'museum', 'nightlife', 'shopping'];

module.exports = {
    name: 'Activity',
    tag: 'Activities',
    path: '/api/activities',
    table: 'activities',
    dbName: 'activity_db',
    description: 'Things to do at a destination. Cached in Redis for GET requests.',
    fields: {
        name: { type: 'string', required: true, example: 'Senso-ji Temple' },
        city: { type: 'string', required: true, example: 'Tokyo' },
        category: { type: 'enum', values: CATEGORIES, required: true, example: 'sightseeing' },
        description: { type: 'text', example: "Tokyo's oldest temple, with a lively market street leading to it." },
        price: { type: 'number', min: 0, default: 0, description: 'Cost per person (0 = free)', example: 0 },
        currency: { type: 'string', maxLength: 3, default: 'USD', example: 'USD' },
        duration_minutes: { type: 'integer', min: 1, example: 90 },
        rating: { type: 'number', min: 0, max: 5, example: 4.7 },
    },
    filters: [
        { param: 'city', column: 'city', op: 'ieq', description: 'City name' },
        { param: 'category', column: 'category', op: 'eq', type: 'enum', values: CATEGORIES, description: 'Activity category' },
        { param: 'maxPrice', column: 'price', op: 'lte', type: 'number', description: 'Highest price per person' },
        { param: 'q', column: 'name', op: 'contains', description: 'Part of the name (case-insensitive)' },
    ],
    sortable: ['name', 'price', 'rating', 'duration_minutes'],
    seed: [
        { name: 'Senso-ji Temple', city: 'Tokyo', category: 'sightseeing', description: "Tokyo's oldest temple, with a lively market street leading to it.", price: 0, duration_minutes: 90, rating: 4.7 },
        { name: 'Tsukiji Outer Market food walk', city: 'Tokyo', category: 'food', description: 'Sample sushi, tamagoyaki and street snacks.', price: 65, duration_minutes: 150, rating: 4.8 },
        { name: 'teamLab Planets', city: 'Tokyo', category: 'museum', description: 'Immersive digital art you walk through barefoot.', price: 32, duration_minutes: 120, rating: 4.6 },
        { name: 'Pike Place Market', city: 'Seattle', category: 'food', description: 'Fish throwing, flowers, and the original Starbucks.', price: 0, duration_minutes: 120, rating: 4.6 },
        { name: 'Mount Rainier day hike', city: 'Seattle', category: 'outdoors', description: 'Paradise area trails with views of the glaciers.', price: 30, duration_minutes: 360, rating: 4.9 },
        { name: 'Museum of Pop Culture', city: 'Seattle', category: 'museum', description: 'Music, sci-fi and pop culture exhibits.', price: 36, duration_minutes: 150, rating: 4.4 },
        { name: 'Shilin Night Market', city: 'Taipei', category: 'food', description: "Taipei's biggest night market.", price: 15, duration_minutes: 180, rating: 4.5 },
        { name: 'Taipei 101 Observatory', city: 'Taipei', category: 'sightseeing', description: 'Indoor and outdoor decks 382 m up.', price: 22, duration_minutes: 90, rating: 4.5 },
    ],
};
