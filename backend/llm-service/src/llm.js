// Asks the language model (Groq) for advice. Without GROQ_API_KEY a placeholder answer is stored.

const Groq = require('groq-sdk');
const { HttpError } = require('./errors');

const MODEL = process.env.LLM_MODEL || 'openai/gpt-oss-20b';
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 30000;

const SYSTEM_PROMPT =
    'You are a friendly travel assistant. Answer the traveler\'s question in under 150 words, ' +
    'with practical, specific tips. Do not invent prices, opening hours or booking details.';

async function generateAdvice({ topic, prompt }) {
    if (!process.env.GROQ_API_KEY) {
        return {
            content: `(No LLM configured) Placeholder ${topic} advice for: ${prompt}`,
            model: 'stub',
            source: 'stub',
        };
    }

    try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: TIMEOUT_MS, maxRetries: 0 });
        const completion = await groq.chat.completions.create({
            model: MODEL,
            temperature: 0.4,
            max_completion_tokens: 800,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: `Topic: ${topic}\nQuestion: ${prompt}` },
            ],
        });
        const content = completion.choices?.[0]?.message?.content?.trim();
        if (!content) throw new Error('empty reply');
        return { content, model: MODEL, source: 'llm' };
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
