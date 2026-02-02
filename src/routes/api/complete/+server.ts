import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const EXTERNAL_API_URL = "http://localhost:8000/complete";

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { prefix, suffix } = await request.json();

    if (!prefix || typeof prefix !== "string") {
      return json({ error: "Prefix is required" }, { status: 400 });
    }

    // Require at least one word before attempting completion
    if (prefix.trim().length < 2) {
      return json({ completion: "" });
    }

    const response = await fetch(EXTERNAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prefix,
        suffix: suffix || "",
        max_tokens: 50,
        temperature: 0.7,
        num_completions: 3,
      }),
    });

    if (!response.ok) {
      console.error("External API error:", response.status, response.statusText);
      return json({ completion: "" });
    }

    const data = await response.json();

    // External API returns { prefix: string, completions: string[] }
    // We return { completion: string } for frontend compatibility
    // Use the first non-empty completion
    const completions: string[] = data.completions || [];
    const completion = completions.find((c) => c && c.trim().length > 0) || "";

    return json({ completion });
  } catch (error) {
    console.error("Completion error:", error);
    // Return empty completion on error rather than failing - graceful degradation
    return json({ completion: "" });
  }
};
