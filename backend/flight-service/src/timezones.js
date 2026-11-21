// SerpApi gives each airport's local time ("2027-01-28 10:15") with no time zone, so the airport's
// IANA zone is looked up here and the time converted to UTC (daylight saving included).
// Unknown airports return null; the caller then works the time out from the flight duration.

const AIRPORT_ZONES = {
    // North America
    SEA: 'America/Los_Angeles', PDX: 'America/Los_Angeles', SFO: 'America/Los_Angeles', SJC: 'America/Los_Angeles',
    OAK: 'America/Los_Angeles', LAX: 'America/Los_Angeles', SAN: 'America/Los_Angeles', LAS: 'America/Los_Angeles',
    YVR: 'America/Vancouver', YYC: 'America/Edmonton', PHX: 'America/Phoenix', DEN: 'America/Denver', SLC: 'America/Denver',
    DFW: 'America/Chicago', IAH: 'America/Chicago', ORD: 'America/Chicago', MSP: 'America/Chicago', AUS: 'America/Chicago',
    ATL: 'America/New_York', MIA: 'America/New_York', MCO: 'America/New_York', JFK: 'America/New_York',
    EWR: 'America/New_York', LGA: 'America/New_York', BOS: 'America/New_York', IAD: 'America/New_York',
    DCA: 'America/New_York', PHL: 'America/New_York', DTW: 'America/Detroit', CLT: 'America/New_York',
    YYZ: 'America/Toronto', YUL: 'America/Toronto', HNL: 'Pacific/Honolulu', ANC: 'America/Anchorage',
    MEX: 'America/Mexico_City', CUN: 'America/Cancun',
    // Asia and Oceania
    NRT: 'Asia/Tokyo', HND: 'Asia/Tokyo', KIX: 'Asia/Tokyo', ITM: 'Asia/Tokyo', NGO: 'Asia/Tokyo', FUK: 'Asia/Tokyo', CTS: 'Asia/Tokyo',
    ICN: 'Asia/Seoul', GMP: 'Asia/Seoul', PUS: 'Asia/Seoul',
    TPE: 'Asia/Taipei', TSA: 'Asia/Taipei', KHH: 'Asia/Taipei', RMQ: 'Asia/Taipei',
    PVG: 'Asia/Shanghai', SHA: 'Asia/Shanghai', PEK: 'Asia/Shanghai', PKX: 'Asia/Shanghai', CAN: 'Asia/Shanghai',
    HKG: 'Asia/Hong_Kong', MFM: 'Asia/Macau', SIN: 'Asia/Singapore', BKK: 'Asia/Bangkok', DMK: 'Asia/Bangkok',
    KUL: 'Asia/Kuala_Lumpur', MNL: 'Asia/Manila', CGK: 'Asia/Jakarta', DPS: 'Asia/Makassar', SGN: 'Asia/Ho_Chi_Minh',
    HAN: 'Asia/Ho_Chi_Minh', DEL: 'Asia/Kolkata', BOM: 'Asia/Kolkata', DXB: 'Asia/Dubai', DOH: 'Asia/Qatar',
    SYD: 'Australia/Sydney', MEL: 'Australia/Melbourne', BNE: 'Australia/Brisbane', AKL: 'Pacific/Auckland',
    // Europe
    LHR: 'Europe/London', LGW: 'Europe/London', CDG: 'Europe/Paris', ORY: 'Europe/Paris', FRA: 'Europe/Berlin',
    MUC: 'Europe/Berlin', AMS: 'Europe/Amsterdam', MAD: 'Europe/Madrid', BCN: 'Europe/Madrid', FCO: 'Europe/Rome',
    ZRH: 'Europe/Zurich', VIE: 'Europe/Vienna', CPH: 'Europe/Copenhagen', DUB: 'Europe/Dublin', IST: 'Europe/Istanbul',
    HEL: 'Europe/Helsinki', LIS: 'Europe/Lisbon',
};

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/;

// Minutes the zone is ahead of UTC at a given instant.
function offsetMinutes(instantMs, zone) {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
            timeZone: zone, hourCycle: 'h23',
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
        }).formatToParts(new Date(instantMs)).map((p) => [p.type, p.value]));
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    return Math.round((asUtc - instantMs) / 60000);
}

// "2027-01-28 10:15" at airport "SEA" -> Date (UTC), or null for an unknown airport or bad time.
function toUtc(localTime, airport) {
    const zone = AIRPORT_ZONES[String(airport).toUpperCase()];
    const m = LOCAL.exec(String(localTime || ''));
    if (!zone || !m) return null;
    const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    // Guess with the offset at the wall time, then correct once (covers daylight-saving changes).
    let utc = wall - offsetMinutes(wall, zone) * 60000;
    utc = wall - offsetMinutes(utc, zone) * 60000;
    return new Date(utc);
}

module.exports = { toUtc, AIRPORT_ZONES };
