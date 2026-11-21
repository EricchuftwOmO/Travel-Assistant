// Major airports for the Flight Search autocomplete: [IATA code, city, airport name, country].
// Typing a city, a code, an airport or a country suggests matches. Any other 3-letter code can still be typed.
const RAW = [
  // United States and Canada
  ['SEA', 'Seattle', 'Seattle-Tacoma International', 'United States'],
  ['PDX', 'Portland', 'Portland International', 'United States'],
  ['SFO', 'San Francisco', 'San Francisco International', 'United States'],
  ['SJC', 'San Jose', 'San José Mineta International', 'United States'],
  ['OAK', 'Oakland', 'Oakland International', 'United States'],
  ['LAX', 'Los Angeles', 'Los Angeles International', 'United States'],
  ['SAN', 'San Diego', 'San Diego International', 'United States'],
  ['LAS', 'Las Vegas', 'Harry Reid International', 'United States'],
  ['PHX', 'Phoenix', 'Phoenix Sky Harbor International', 'United States'],
  ['DEN', 'Denver', 'Denver International', 'United States'],
  ['SLC', 'Salt Lake City', 'Salt Lake City International', 'United States'],
  ['DFW', 'Dallas', 'Dallas/Fort Worth International', 'United States'],
  ['IAH', 'Houston', 'George Bush Intercontinental', 'United States'],
  ['AUS', 'Austin', 'Austin-Bergstrom International', 'United States'],
  ['ORD', 'Chicago', "O'Hare International", 'United States'],
  ['MSP', 'Minneapolis', 'Minneapolis-Saint Paul International', 'United States'],
  ['DTW', 'Detroit', 'Detroit Metropolitan Wayne County', 'United States'],
  ['ATL', 'Atlanta', 'Hartsfield-Jackson Atlanta International', 'United States'],
  ['MIA', 'Miami', 'Miami International', 'United States'],
  ['MCO', 'Orlando', 'Orlando International', 'United States'],
  ['CLT', 'Charlotte', 'Charlotte Douglas International', 'United States'],
  ['JFK', 'New York', 'John F. Kennedy International', 'United States'],
  ['EWR', 'New York', 'Newark Liberty International', 'United States'],
  ['LGA', 'New York', 'LaGuardia', 'United States'],
  ['BOS', 'Boston', 'Logan International', 'United States'],
  ['PHL', 'Philadelphia', 'Philadelphia International', 'United States'],
  ['IAD', 'Washington', 'Washington Dulles International', 'United States'],
  ['DCA', 'Washington', 'Ronald Reagan Washington National', 'United States'],
  ['HNL', 'Honolulu', 'Daniel K. Inouye International', 'United States'],
  ['ANC', 'Anchorage', 'Ted Stevens Anchorage International', 'United States'],
  ['YVR', 'Vancouver', 'Vancouver International', 'Canada'],
  ['YYC', 'Calgary', 'Calgary International', 'Canada'],
  ['YYZ', 'Toronto', 'Toronto Pearson International', 'Canada'],
  ['YUL', 'Montreal', 'Montréal-Trudeau International', 'Canada'],
  ['MEX', 'Mexico City', 'Mexico City International', 'Mexico'],
  ['CUN', 'Cancún', 'Cancún International', 'Mexico'],
  // Asia
  ['TPE', 'Taipei', 'Taoyuan International', 'Taiwan'],
  ['TSA', 'Taipei', 'Songshan', 'Taiwan'],
  ['KHH', 'Kaohsiung', 'Kaohsiung International', 'Taiwan'],
  ['RMQ', 'Taichung', 'Taichung International', 'Taiwan'],
  ['NRT', 'Tokyo', 'Narita International', 'Japan'],
  ['HND', 'Tokyo', 'Haneda', 'Japan'],
  ['KIX', 'Osaka', 'Kansai International', 'Japan'],
  ['ITM', 'Osaka', 'Itami', 'Japan'],
  ['NGO', 'Nagoya', 'Chubu Centrair International', 'Japan'],
  ['FUK', 'Fukuoka', 'Fukuoka', 'Japan'],
  ['CTS', 'Sapporo', 'New Chitose', 'Japan'],
  ['ICN', 'Seoul', 'Incheon International', 'South Korea'],
  ['GMP', 'Seoul', 'Gimpo International', 'South Korea'],
  ['PUS', 'Busan', 'Gimhae International', 'South Korea'],
  ['PVG', 'Shanghai', 'Pudong International', 'China'],
  ['SHA', 'Shanghai', 'Hongqiao International', 'China'],
  ['PEK', 'Beijing', 'Capital International', 'China'],
  ['PKX', 'Beijing', 'Daxing International', 'China'],
  ['CAN', 'Guangzhou', 'Baiyun International', 'China'],
  ['HKG', 'Hong Kong', 'Hong Kong International', 'Hong Kong'],
  ['MFM', 'Macau', 'Macau International', 'Macau'],
  ['SIN', 'Singapore', 'Changi', 'Singapore'],
  ['BKK', 'Bangkok', 'Suvarnabhumi', 'Thailand'],
  ['DMK', 'Bangkok', 'Don Mueang International', 'Thailand'],
  ['KUL', 'Kuala Lumpur', 'Kuala Lumpur International', 'Malaysia'],
  ['MNL', 'Manila', 'Ninoy Aquino International', 'Philippines'],
  ['CGK', 'Jakarta', 'Soekarno-Hatta International', 'Indonesia'],
  ['DPS', 'Bali', 'Ngurah Rai International', 'Indonesia'],
  ['SGN', 'Ho Chi Minh City', 'Tan Son Nhat International', 'Vietnam'],
  ['HAN', 'Hanoi', 'Noi Bai International', 'Vietnam'],
  ['DEL', 'Delhi', 'Indira Gandhi International', 'India'],
  ['BOM', 'Mumbai', 'Chhatrapati Shivaji Maharaj International', 'India'],
  ['DXB', 'Dubai', 'Dubai International', 'United Arab Emirates'],
  ['DOH', 'Doha', 'Hamad International', 'Qatar'],
  // Oceania
  ['SYD', 'Sydney', 'Kingsford Smith', 'Australia'],
  ['MEL', 'Melbourne', 'Melbourne', 'Australia'],
  ['BNE', 'Brisbane', 'Brisbane', 'Australia'],
  ['AKL', 'Auckland', 'Auckland', 'New Zealand'],
  // Europe
  ['LHR', 'London', 'Heathrow', 'United Kingdom'],
  ['LGW', 'London', 'Gatwick', 'United Kingdom'],
  ['CDG', 'Paris', 'Charles de Gaulle', 'France'],
  ['ORY', 'Paris', 'Orly', 'France'],
  ['FRA', 'Frankfurt', 'Frankfurt', 'Germany'],
  ['MUC', 'Munich', 'Munich', 'Germany'],
  ['AMS', 'Amsterdam', 'Schiphol', 'Netherlands'],
  ['MAD', 'Madrid', 'Adolfo Suárez Madrid-Barajas', 'Spain'],
  ['BCN', 'Barcelona', 'Josep Tarradellas Barcelona-El Prat', 'Spain'],
  ['FCO', 'Rome', 'Fiumicino', 'Italy'],
  ['ZRH', 'Zurich', 'Zurich', 'Switzerland'],
  ['VIE', 'Vienna', 'Vienna International', 'Austria'],
  ['CPH', 'Copenhagen', 'Copenhagen', 'Denmark'],
  ['DUB', 'Dublin', 'Dublin', 'Ireland'],
  ['IST', 'Istanbul', 'Istanbul', 'Türkiye'],
  ['HEL', 'Helsinki', 'Helsinki-Vantaa', 'Finland'],
  ['LIS', 'Lisbon', 'Humberto Delgado', 'Portugal'],
];

export const AIRPORTS = RAW.map(([code, city, name, country]) => ({ code, city, name, country }));

const fold = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Best matches first: the code itself, then a city or airport name starting with the text, then anything containing it.
export function searchAirports(text, limit = 8) {
  const q = fold(text.trim());
  if (!q) return [];
  const scored = [];
  for (const airport of AIRPORTS) {
    const code = airport.code.toLowerCase();
    const city = fold(airport.city);
    const name = fold(airport.name);
    const country = fold(airport.country);
    let score = -1;
    if (code === q) score = 0;
    else if (code.startsWith(q)) score = 1;
    else if (city.startsWith(q)) score = 2;
    else if (city.split(/[\s-]+/).some((word) => word.startsWith(q)) || name.startsWith(q)) score = 3;
    else if (country.startsWith(q)) score = 4;
    else if (city.includes(q) || name.includes(q)) score = 5;
    if (score >= 0) scored.push({ airport, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.airport.city.localeCompare(b.airport.city))
    .slice(0, limit)
    .map((entry) => entry.airport);
}

export const airportByCode = (code) => AIRPORTS.find((a) => a.code === String(code).toUpperCase()) || null;
