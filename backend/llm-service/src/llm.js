// Asks the language model (Groq) for advice. Without GROQ_API_KEY it answers with a travel joke (stub mode).

const Groq = require('groq-sdk');
const { HttpError } = require('./errors');
const { pickJoke } = require('./jokes');
const { runAgent } = require('./agent');

const MODEL = process.env.LLM_MODEL || 'openai/gpt-oss-20b';
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 30000;

const FLIGHT_SERVICE_URL = process.env.FLIGHT_SERVICE_URL || 'http://localhost:3004';

// One model call through Groq, returning the assistant message ({ content, tool_calls }).
const groqCompletion = () => {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: TIMEOUT_MS, maxRetries: 0 });
    return async ({ messages, tools, tool_choice }) => {
        const completion = await groq.chat.completions.create({
            model: MODEL,
            temperature: 0.4,
            // The model reasons before it answers or calls a tool, so it needs room for both.
            max_completion_tokens: 1500,
            messages,
            tools,
            tool_choice,
        });
        return completion.choices?.[0]?.message || {};
    };
};

// complete: optional model call for tests (defaults to Groq).
async function generateAdvice({ topic, prompt }, { complete, fetchImpl } = {}) {
    // Stub mode: no model to ask, so answer with a travel joke (labelled "stub" for clients).
    if (!process.env.GROQ_API_KEY && !complete) {
        return {
            content: pickJoke(),
            model: 'stub',
            source: 'stub',
        };
    }

    try {
        // A tool-calling chain: the model may search flights (up to the cap) before it answers.
        const { content, steps, flights } = await runAgent({
            prompt: `Topic: ${topic}\nQuestion: ${prompt}`,
            complete: complete || groqCompletion(),
            flightServiceUrl: FLIGHT_SERVICE_URL,
            fetchImpl,
        });
        if (!content) throw new Error('empty reply');
        return {
            content,
            model: MODEL,
            source: 'llm',
            // Saved with the advice so the app can show what was searched and the flights found.
            tool_steps: steps.length ? JSON.stringify(steps) : null,
            flights: flights.length ? JSON.stringify(flights) : null,
        };
    } catch (err) {
        console.error(`[llm] request failed: ${err.message}`);
        throw new HttpError(502, 'LLM_UNAVAILABLE', 'The language model did not give an answer. Try again, or send your own "content".');
    }
}

const hooks = {
    async beforeCreate(values) {
        if (values.content) {
            Object.assign(values, { model: 'user', source: 'user' });
        } else {
            Object.assign(values, await generateAdvice({ topic: values.topic || 'general', prompt: values.prompt }));
        }
    },
};

module.exports = { hooks, generateAdvice };
