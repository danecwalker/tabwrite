import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getOpenAIClient, DEFAULT_MODEL } from "$lib/models/openai";

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
    const client = getOpenAIClient();
    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return json({ error: "Text is required" }, { status: 400 });
    }

    // Require substantial text before attempting citation detection
    if (text.length < 50) {
      return json({ claims: [] });
    }

    const response = await client.chat.completions.create({
      model: DEFAULT_MODEL,
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

    let content = response.choices[0]?.message?.content?.trim() || "[]";

    // Extract JSON array from response - LLM may wrap in markdown or add commentary
    function extractJsonArray(text: string): string {
      // Find the first '[' and last ']' to extract the array
      const start = text.indexOf("[");
      const end = text.lastIndexOf("]");
      if (start !== -1 && end !== -1 && end > start) {
        return text.slice(start, end + 1);
      }
      return "[]";
    }

    content = extractJsonArray(content);

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
