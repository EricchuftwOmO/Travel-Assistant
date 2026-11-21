// Stub mode answers with a travel joke instead of calling the model.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JOKES, pickJoke } = require('../src/jokes');
const { generateAdvice } = require('../src/llm');

test('every joke is a non-empty, distinct line', () => {
  assert.ok(JOKES.length >= 10);
  assert.equal(new Set(JOKES).size, JOKES.length);
  for (const joke of JOKES) assert.ok(joke.trim().length > 10, joke);
});

test('pickJoke covers the whole list', () => {
  assert.equal(pickJoke(() => 0), JOKES[0]);
  assert.equal(pickJoke(() => 0.9999), JOKES[JOKES.length - 1]);
});

test('without GROQ_API_KEY the answer is a joke labelled stub', async () => {
  const saved = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  try {
    const answer = await generateAdvice({ topic: 'packing', prompt: 'What should I pack for Tokyo?' });
    assert.ok(JOKES.includes(answer.content));
    assert.equal(answer.source, 'stub');
    assert.equal(answer.model, 'stub');
  } finally {
    if (saved !== undefined) process.env.GROQ_API_KEY = saved;
  }
});
