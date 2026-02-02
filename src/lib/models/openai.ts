import OpenAI from "openai";
import { env } from "$env/dynamic/private";

export function getOpenAIClient(): OpenAI {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "tabwrite.com",
      "X-Title": "TabWrite",
    },
  });
}

export const DEFAULT_MODEL = "meta-llama/llama-3.1-8b-instruct";
export const WRITING_MODEL = "moonshotai/kimi-k2-thinking";
