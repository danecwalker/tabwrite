import { json } from "@sveltejs/kit";
import OpenAI from "openai";
import { env } from "$env/dynamic/private";
import type { RequestHandler } from "./$types";

function getClient() {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "tabwrite.com", // Optional. Site URL for rankings on openrouter.ai.
      "X-Title": "TabWrite", // Optional. Site title for rankings on openrouter.ai.
    },
  });
}

const SYSTEM_PROMPT = `You are an academic citation assistant. Analyze the given essay text and identify claims, statistics, facts, or quotations that would benefit from citations.

For each citation-worthy claim, provide:
1. The exact text of the claim (verbatim from the essay)
2. A search query that could be used to find supporting sources
3. The character indices where this claim appears in the text

CRITICAL RULES:
1. Only identify claims that genuinely need citations (statistics, factual claims, research findings, quotations)
2. Do NOT flag common knowledge or obvious statements
3. Do NOT flag opinions or arguments (only factual claims)
4. Be selective - only the most important 3-5 claims that truly need sources
5. The claim text must be an EXACT substring from the input

OUTPUT FORMAT:
Return a JSON array with objects containing:
- claim: the exact text needing citation (must be verbatim from input)
- searchQuery: a good search query to find sources for this claim
- startIndex: character index where the claim starts in the input
- endIndex: character index where the claim ends in the input

If no claims need citations, return an empty array [].
Return ONLY valid JSON, no other text.`;

export interface CitationClaim {
  claim: string;
  searchQuery: string;
  startIndex: number;
  endIndex: number;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const client = getClient();
    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return json({ error: "Text is required" }, { status: 400 });
    }

    // Require substantial text before attempting citation detection
    if (text.length < 50) {
      return json({ claims: [] });
    }

    const response = await client.chat.completions.create({
      model: "meta-llama/llama-3.1-8b-instruct",
      max_tokens: 1000,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim() || "[]";

    let claims: CitationClaim[] = [];
    try {
      // Parse the JSON response
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        // Validate and correct indices for each claim
        claims = parsed
          .filter(
            (item): item is CitationClaim =>
              typeof item.claim === "string" &&
              typeof item.searchQuery === "string" &&
              typeof item.startIndex === "number" &&
              typeof item.endIndex === "number",
          )
          .map((item) => {
            // Verify and correct the indices by finding the actual position
            const actualIndex = text.indexOf(item.claim);
            if (actualIndex !== -1) {
              return {
                claim: item.claim,
                searchQuery: item.searchQuery,
                startIndex: actualIndex,
                endIndex: actualIndex + item.claim.length,
              };
            }
            // If exact match not found, keep original indices
            return item;
          });
      }
    } catch {
      // If JSON parsing fails, return empty claims
      console.error("Failed to parse citation claims:", content);
      claims = [];
    }

    return json({ claims });
  } catch (error) {
    console.error("Citation detection error:", error);
    return json({ error: "Failed to detect citations" }, { status: 500 });
  }
};
