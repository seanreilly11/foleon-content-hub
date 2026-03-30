import OpenAI from "openai";

// Note: validateEnv() is called in app.ts before this module is imported,
// so process.env.OPENAI_API_KEY is guaranteed to exist here.
export const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
});
