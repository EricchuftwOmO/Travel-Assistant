// TCSS 559 Autumn 2026
// Travel Assistant - Flight Service: the flight resource (fields, filters, sample data).
// crud.js builds the table, validation and routes from this one definition.

module.exports = {
    name: 'Flight',
    tag: 'Flights',
    path: '/api/flights',
    table: 'flights',
    dbName: 'flight_db',
    description: 'Flights a traveler can pick for a trip. Cached in Redis for GET requests.',
    fields: {
        airline: { type: 'string', required: true, example: 'Alaska Airlines' },
        flight_number: { type: 'string', required: true, maxLength: 10, example: 'AS 21' },
        origin: { type: 'string', required: true, maxLength: 3, description: 'Origin airport code', example: 'SEA' },
        destination: { type: 'string', required: true, maxLength: 3, description: 'Destination airport code', example: 'HND' },
        depart_at: { type: 'datetime', required: true, example: '2026-12-01T10:15:00Z' },
        arrive_at: { type: 'datetime', required: true, example: '2026-12-02T14:05:00Z' },
        price: { type: 'number', required: true, min: 0, description: 'Price per passenger', example: 845.5 },
        currency: { type: 'string', maxLength: 3, default: 'USD', example: 'USD' },
        seats_available: { type: 'integer', min: 0, default: 0, example: 12 },
    },
    filters: [
        { param: 'origin', column: 'origin', op: 'ieq', description: 'Origin airport code' },
        { param: 'destination', column: 'destination', op: 'ieq', description: 'Destination airport code' },
        { param: 'departDate', column: 'depart_at', op: 'date', type: 'date', description: 'Departure date (YYYY-MM-DD)' },
        { param: 'maxPrice', column: 'price', op: 'lte', type: 'number', description: 'Highest price' },
    ],
    sortable: ['price', 'depart_at', 'arrive_at'],
    seed: [
        { airline: 'Alaska Airlines', flight_number: 'AS 21', origin: 'SEA', destination: 'HND', depart_at: '2026-12-01T10:15:00Z', arrive_at: '2026-12-02T14:05:00Z', price: 845.5, seats_available: 12 },
        { airline: 'ANA', flight_number: 'NH 177', origin: 'SEA', destination: 'HND', depart_at: '2026-12-01T19:40:00Z', arrive_at: '2026-12-03T00:10:00Z', price: 912, seats_available: 5 },
        { airline: 'Delta', flight_number: 'DL 167', origin: 'SEA', destination: 'ICN', depart_at: '2026-12-02T12:00:00Z', arrive_at: '2026-12-03T16:20:00Z', price: 780.25, seats_available: 20 },
        { airline: 'EVA Air', flight_number: 'BR 17', origin: 'SEA', destination: 'TPE', depart_at: '2027-02-01T01:30:00Z', arrive_at: '2027-02-02T05:15:00Z', price: 698, seats_available: 8 },
        { airline: 'Alaska Airlines', flight_number: 'AS 1', origin: 'LAX', destination: 'SEA', depart_at: '2027-01-10T15:00:00Z', arrive_at: '2027-01-10T17:45:00Z', price: 129.99, seats_available: 31 },
        { airline: 'United', flight_number: 'UA 2371', origin: 'SFO', destination: 'SEA', depart_at: '2027-01-10T09:20:00Z', arrive_at: '2027-01-10T11:35:00Z', price: 119, seats_available: 17 },
    ],
};
