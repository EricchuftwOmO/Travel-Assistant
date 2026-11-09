// TCSS 559 Autumn 2026
// Travel Assistant - Car Rental Service: the car rental resource (fields, filters, sample data).
// crud.js builds the table, validation and routes from this one definition.

const CAR_TYPES = ['economy', 'compact', 'suv', 'van', 'luxury'];

module.exports = {
    name: 'Car rental',
    tag: 'Car rentals',
    path: '/api/car-rentals',
    table: 'car_rentals',
    dbName: 'car_rental_db',
    description: 'Rental cars a traveler can pick for a trip. Cached in Redis for GET requests.',
    fields: {
        company: { type: 'string', required: true, example: 'Hertz' },
        car_type: { type: 'enum', values: CAR_TYPES, required: true, example: 'compact' },
        model: { type: 'string', required: true, example: 'Toyota Corolla' },
        pickup_city: { type: 'string', required: true, example: 'Seattle' },
        seats: { type: 'integer', min: 1, max: 15, default: 5, example: 5 },
        transmission: { type: 'enum', values: ['automatic', 'manual'], default: 'automatic', example: 'automatic' },
        price_per_day: { type: 'number', required: true, min: 0, example: 54 },
        currency: { type: 'string', maxLength: 3, default: 'USD', example: 'USD' },
        available: { type: 'boolean', default: true, example: true },
    },
    filters: [
        { param: 'city', column: 'pickup_city', op: 'ieq', description: 'Pickup city' },
        { param: 'carType', column: 'car_type', op: 'eq', type: 'enum', values: CAR_TYPES, description: 'Car category' },
        { param: 'minSeats', column: 'seats', op: 'gte', type: 'integer', description: 'Fewest seats' },
        { param: 'maxPrice', column: 'price_per_day', op: 'lte', type: 'number', description: 'Highest price per day' },
        { param: 'available', column: 'available', op: 'eq', type: 'boolean', description: 'Only available (true) or unavailable (false) cars' },
    ],
    sortable: ['price_per_day', 'seats'],
    seed: [
        { company: 'Hertz', car_type: 'compact', model: 'Toyota Corolla', pickup_city: 'Seattle', seats: 5, price_per_day: 54 },
        { company: 'Enterprise', car_type: 'suv', model: 'Ford Explorer', pickup_city: 'Seattle', seats: 7, price_per_day: 92 },
        { company: 'Avis', car_type: 'economy', model: 'Nissan Versa', pickup_city: 'Seattle', seats: 5, price_per_day: 39, available: false },
        { company: 'Toyota Rent a Car', car_type: 'compact', model: 'Toyota Yaris', pickup_city: 'Tokyo', seats: 5, price_per_day: 61 },
        { company: 'Nippon Rent-A-Car', car_type: 'van', model: 'Toyota Alphard', pickup_city: 'Tokyo', seats: 7, price_per_day: 148 },
        { company: 'Hotai Leasing', car_type: 'luxury', model: 'Lexus ES', pickup_city: 'Taipei', seats: 5, price_per_day: 135 },
    ],
};
