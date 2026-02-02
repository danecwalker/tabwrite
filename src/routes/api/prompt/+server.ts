import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  getOpenAIClient,
  DEFAULT_MODEL,
  WRITING_MODEL,
} from "$lib/models/openai";

export type ActionType =
  | "rewrite"
  | "analyze"
  | "expand"
  | "summarize"
  | "custom";

interface PromptRequest {
  selectedText: string;
  instruction: string;
  actionType: ActionType;
  documentContext?: string;
}

interface PromptResponse {
  result: string;
  actionType: ActionType;
}

const BASE_RULES = `
IMPORTANT RULES:
- Do NOT use markdown formatting (no **, #, -, *, etc.)
- Write in plain prose only
- Keep your response to about one paragraph (3-5 sentences)
- Return ONLY the requested content, no explanations or preamble
- Match the writing style, tone, and voice of the document context provided
- Do NOT write meta-commentary like "The text presents..." or "This paragraph discusses..."
- Write as a natural continuation of the document, not as an analysis of it`;

function getSystemPrompt(actionType: ActionType): string {
  switch (actionType) {
    case "rewrite":
      return `You are a writing assistant. Rewrite the given text according to the user's instruction.
Keep the meaning intact while improving clarity, style, or tone as requested.
${BASE_RULES}`;

    case "analyze":
      return `You are a writing assistant. Based on the given text, write additional content that explores or elaborates on its ideas.
Write as a continuation of the document, not as commentary about it.
${BASE_RULES}`;

    case "expand":
      return `You are a writing assistant. Expand on the given text with more detail and depth.
Maintain the original tone and style while adding relevant information.
${BASE_RULES}`;

    case "summarize":
      return `You are a writing assistant. Summarize the given text concisely.
Capture the key points while being brief.
${BASE_RULES}`;

    case "custom":
    default:
      return `You are a helpful writing assistant. Follow the user's instruction precisely.
${BASE_RULES}`;
  }
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const client = getOpenAIClient();
    const body: PromptRequest = await request.json();

    const { selectedText, instruction, actionType, documentContext } = body;

    if (!selectedText || typeof selectedText !== "string") {
      return json({ error: "Selected text is required" }, { status: 400 });
    }

    if (!instruction || typeof instruction !== "string") {
      return json({ error: "Instruction is required" }, { status: 400 });
    }

    const systemPrompt = getSystemPrompt(actionType);

    // Build user prompt with optional document context
    let userPrompt = "";

    if (documentContext && documentContext.trim().length > 0) {
      // Truncate context if too long (keep first ~2000 chars for style reference)
      const truncatedContext =
        documentContext.length > 2000
          ? documentContext.slice(0, 2000) + "..."
          : documentContext;

      userPrompt += `Document context (use this as a style and tone guide):
"""
${truncatedContext}
"""

`;
    }

    userPrompt += `Text to work with:
"""
${selectedText}
"""

Instruction: ${instruction}`;

    const response = await client.chat.completions.create({
      model: WRITING_MODEL,
      max_tokens: 2000,
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const result = response.choices[0]?.message?.content?.trim() || "";

    const responseData: PromptResponse = {
      result,
      actionType,
    };

    return json(responseData);
  } catch (error) {
    console.error("Prompt API error:", error);
    return json({ error: "Failed to process prompt" }, { status: 500 });
  }
};
