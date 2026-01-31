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

const SYSTEM_PROMPT_MID_WORD = `You are an intelligent writing assistant providing inline completions for essays.

CONTEXT: The writer is MID-WORD. Complete the current word and optionally continue the sentence.

CRITICAL RULES:
1. First, complete the partial word naturally based on context.
2. You may continue with a few more words to finish the thought.
3. Deeply understand the essay's topic before suggesting.
4. Match vocabulary, tone, and style exactly.
5. If uncertain what word they're typing, output nothing.

OUTPUT FORMAT:
- Output ONLY the completion (rest of word + optionally a few more words).
- Do NOT repeat any characters already typed.
- If unsure, return empty.`;

const SYSTEM_PROMPT_MID_SENTENCE = `You are an intelligent writing assistant providing inline completions for essays.

CONTEXT: The writer is MID-SENTENCE (after a space or punctuation, but sentence not finished).

CRITICAL RULES:
1. Continue and complete their current sentence naturally.
2. Deeply understand the essay's topic and argument.
3. Only complete the thought already begun - no new ideas or tangents.
4. Match vocabulary, tone, and style exactly.
5. If uncertain about direction, output nothing.

OUTPUT FORMAT:
- Output ONLY the completion text (5-20 words max).
- Do NOT repeat words from the end of the text.
- If unsure, return empty.`;

const SYSTEM_PROMPT_NEW_SENTENCE = `You are an intelligent writing assistant providing inline completions for essays.

CONTEXT: The writer just FINISHED a sentence. Suggest a new sentence.

CRITICAL RULES:
1. Suggest the START of a new sentence that logically follows.
2. Begin with a space then a capital letter.
3. The new sentence must continue the essay's argument - no tangents.
4. Deeply understand the topic and direction first.
5. Match vocabulary, tone, and style exactly.
6. If uncertain what should come next, output nothing.

OUTPUT FORMAT:
- Output ONLY the new sentence start (5-20 words max).
- Start with a space, then capital letter.
- If unsure, return empty.`;

type CompletionContext = "mid-word" | "mid-sentence" | "new-sentence";

function detectContext(text: string): CompletionContext {
  // Check if ends with sentence-ending punctuation (possibly followed by space)
  if (/[.!?]\s*$/.test(text)) {
    return "new-sentence";
  }

  // Check if ends with whitespace or mid-sentence punctuation
  if (/[\s,;:'")\]\-]$/.test(text)) {
    return "mid-sentence";
  }

  // Otherwise we're mid-word
  return "mid-word";
}

function getPromptForContext(ctx: CompletionContext): string {
  switch (ctx) {
    case "mid-word":
      return SYSTEM_PROMPT_MID_WORD;
    case "mid-sentence":
      return SYSTEM_PROMPT_MID_SENTENCE;
    case "new-sentence":
      return SYSTEM_PROMPT_NEW_SENTENCE;
  }
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const client = getClient();
    const { context } = await request.json();

    if (!context || typeof context !== "string") {
      return json({ error: "Context is required" }, { status: 400 });
    }

    // Require substantial context before attempting completion
    if (context.length < 100) {
      return json({ completion: "" });
    }

    const completionContext = detectContext(context);
    const systemPrompt = getPromptForContext(completionContext);

    const response = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      max_tokens: 40,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: context,
        },
      ],
    });

    let completion = response.choices[0]?.message?.content?.trim() || "";

    // Ensure new sentences start with a space
    if (completionContext === "new-sentence" && completion && !completion.startsWith(" ")) {
      completion = " " + completion;
    }

    return json({ completion });
  } catch (error) {
    console.error("Completion error:", error);
    return json({ error: "Failed to generate completion" }, { status: 500 });
  }
};
