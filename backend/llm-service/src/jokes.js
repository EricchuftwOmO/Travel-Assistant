// Stub mode (no GROQ_API_KEY): instead of a dry placeholder, the assistant tells a travel joke.
// The answer is still saved with source "stub", so clients can label it.

const JOKES = [
  "Why don't mountains ever get cold? They wear snow caps.",
  "I told my suitcase there would be no vacation this year. Now I'm dealing with emotional baggage.",
  "Why did the scarecrow get a free upgrade? He was outstanding in his field.",
  "I used to hate airport security, but it has really grown on me. Slowly. One full-body scan at a time.",
  "What do you call a dinosaur that loves to travel? A Tour-annosaurus.",
  "My travel budget and I have agreed to see other people.",
  "Why did the map break up with the compass? It felt like it was always being told which way to go.",
  "I asked the hotel for a room with a view. They gave me a mirror.",
  "Why can't you hear a pterodactyl use the bathroom on a plane? Because the P is silent.",
  "Packing light is easy. I just leave the light behind and bring everything else.",
  "What did the ocean say to the beach? Nothing, it just waved.",
  "Why do seagulls fly over the sea? If they flew over the bay, they'd be bagels.",
  "I tried to catch fog in Seattle yesterday. I mist.",
  "Jet lag is just your body refusing to accept the new time zone like a stubborn houseguest.",
  "Why did the tourist bring a ladder to the bar? They heard the drinks were on the house.",
  "What's a pirate's favorite travel destination? Arrrr-gentina.",
  "My GPS said 'In 400 feet, turn right.' I said, 'Who are you to tell me how to live my life?' Now I'm lost.",
  "Why are elevator jokes so good? They work on so many levels. Unlike the hotel elevator.",
  "I booked a window seat so I could see where I'm going. Mostly I see clouds, so the future looks foggy.",
  "What do you call a sleeping bull at the airport? A bulldozer at gate B12.",
];

// A different joke each time; pass `random` to make it predictable in tests.
const pickJoke = (random = Math.random) => JOKES[Math.floor(random() * JOKES.length)];

module.exports = { JOKES, pickJoke };
