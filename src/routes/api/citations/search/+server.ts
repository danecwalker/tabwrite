import { json } from "@sveltejs/kit";
import OpenAI from "openai";
import { env } from "$env/dynamic/private";
import type { RequestHandler } from "./$types";

function getClient() {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
}

const SYSTEM_PROMPT = `You are an academic citation assistant. Given a claim or search query, suggest relevant academic sources that could support this claim.

Generate 3-5 plausible academic citations that would be appropriate for supporting the given claim. These should be realistic-sounding academic sources including:
- Peer-reviewed journal articles
- Books by recognized experts
- Reports from reputable organizations
- Conference proceedings

For each citation, provide:
1. title: The full title of the work
2. authors: List of author names (Last, First format)
3. year: Publication year (realistic, usually 2010-2024)
4. url: A plausible URL (use doi.org for journals, or reputable publisher domains)
5. relevance: A brief explanation of why this source is relevant (1 sentence)

OUTPUT FORMAT:
Return a JSON array with objects containing:
- title: string
- authors: string[] (array of author names)
- year: number
- url: string
- relevance: string

Return ONLY valid JSON, no other text.`;

export interface CitationSuggestion {
  title: string;
  authors: string[];
  year: number;
  url: string;
  relevance: string;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const client = getClient();
    const { query } = await request.json();

    if (!query || typeof query !== "string") {
      return json({ error: "Query is required" }, { status: 400 });
    }

    if (query.trim().length < 3) {
      return json({ error: "Query must be at least 3 characters" }, { status: 400 });
    }

    const response = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      max_tokens: 1500,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Find academic sources for this claim: "${query}"`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim() || "[]";

    let citations: CitationSuggestion[] = [];
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        citations = parsed
          .filter((item): item is CitationSuggestion =>
            typeof item.title === "string" &&
            Array.isArray(item.authors) &&
            item.authors.every((a: unknown) => typeof a === "string") &&
            typeof item.year === "number" &&
            typeof item.url === "string" &&
            typeof item.relevance === "string"
          )
          .slice(0, 5); // Ensure we return at most 5 suggestions
      }
    } catch {
      console.error("Failed to parse citation suggestions:", content);
      citations = [];
    }

    return json({ citations });
  } catch (error) {
    console.error("Citation search error:", error);
    return json({ error: "Failed to search for citations" }, { status: 500 });
  }
};
