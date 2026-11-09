// TCSS 559 Autumn 2026
// Travel Assistant - Hotel Service: the hotel resource (fields, filters, sample data).
// crud.js builds the table, validation and routes from this one definition.

module.exports = {
    name: 'Hotel',
    tag: 'Hotels',
    path: '/api/hotels',
    table: 'hotels',
    dbName: 'hotel_db',
    description: 'Hotels a traveler can pick for a trip. Cached in Redis for GET requests.',
    fields: {
        name: { type: 'string', required: true, example: 'Hotel Gracery Shinjuku' },
        city: { type: 'string', required: true, example: 'Tokyo' },
        country: { type: 'string', required: true, example: 'Japan' },
        address: { type: 'string', example: '1-19-1 Kabukicho, Shinjuku' },
        stars: { type: 'integer', required: true, min: 1, max: 5, example: 4 },
        price_per_night: { type: 'number', required: true, min: 0, example: 165 },
        currency: { type: 'string', maxLength: 3, default: 'USD', example: 'USD' },
        rating: { type: 'number', min: 0, max: 10, description: 'Guest rating, 0 to 10', example: 8.6 },
        available: { type: 'boolean', default: true, example: true },
    },
    filters: [
        { param: 'city', column: 'city', op: 'ieq', description: 'City name' },
        { param: 'country', column: 'country', op: 'ieq', description: 'Country name' },
        { param: 'minStars', column: 'stars', op: 'gte', type: 'integer', description: 'Fewest stars' },
        { param: 'maxPrice', column: 'price_per_night', op: 'lte', type: 'number', description: 'Highest price per night' },
        { param: 'available', column: 'available', op: 'eq', type: 'boolean', description: 'Only available (true) or unavailable (false) hotels' },
    ],
    sortable: ['price_per_night', 'stars', 'rating'],
    seed: [
        { name: 'Hotel Gracery Shinjuku', city: 'Tokyo', country: 'Japan', address: '1-19-1 Kabukicho, Shinjuku', stars: 4, price_per_night: 165, rating: 8.6 },
        { name: 'Tokyo Station Hotel', city: 'Tokyo', country: 'Japan', address: '1-9-1 Marunouchi, Chiyoda', stars: 5, price_per_night: 410, rating: 9.2 },
        { name: 'Sakura Capsule Inn', city: 'Tokyo', country: 'Japan', address: '2-3-5 Asakusa, Taito', stars: 2, price_per_night: 48, rating: 7.4 },
        { name: 'Staypineapple Seattle', city: 'Seattle', country: 'United States', address: '1100 5th Ave', stars: 4, price_per_night: 189, rating: 8.8 },
        { name: 'Hotel Max', city: 'Seattle', country: 'United States', address: '620 Stewart St', stars: 3, price_per_night: 139, rating: 8.1, available: false },
        { name: 'Mandarin Oriental Taipei', city: 'Taipei', country: 'Taiwan', address: '158 Dunhua N Rd', stars: 5, price_per_night: 380, rating: 9.4 },
    ],
};
