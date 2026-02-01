import { json } from "@sveltejs/kit";
import OpenAI from "openai";
import { env } from "$env/dynamic/private";
import type { RequestHandler } from "./$types";
import { getResultsForQuery } from "$lib/tools/searchPapers";

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

// Tool definitions in XML format for the prompt
const TOOLS_XML = `
<tools>
  <tool name="think">
    <description>Use this tool to pause and reason through a problem. This helps you plan your approach, evaluate results, or decide next steps. The thought is recorded but has no side effects.</description>
    <parameters>
      <param name="thought" type="string" required="true">Your detailed reasoning, analysis, or planning</param>
    </parameters>
    <example>
      <action>think</action>
      <params>{"thought": "The claim mentions neural networks and performance. I should search for benchmark papers comparing architectures."}</params>
    </example>
  </tool>

  <tool name="search_papers">
    <description>Search for academic papers on arXiv and Semantic Scholar. Returns real papers with titles, authors, abstracts, URLs, and citation counts.</description>
    <parameters>
      <param name="query" type="string" required="true">Academic search query. Use specific terminology and key concepts.</param>
    </parameters>
    <example>
      <action>search_papers</action>
      <params>{"query": "transformer architecture benchmark comparison"}</params>
    </example>
  </tool>

  <tool name="select_paper">
    <description>Select a paper as relevant and provide an excerpt from its abstract that supports the claim. Use this after reviewing search results.</description>
    <parameters>
      <param name="paper_index" type="number" required="true">Index of the paper from the most recent search results (0-based)</param>
      <param name="excerpt" type="string" required="true">A 1-2 sentence excerpt or summary from the abstract explaining how this paper supports the claim</param>
    </parameters>
    <example>
      <action>select_paper</action>
      <params>{"paper_index": 0, "excerpt": "The authors demonstrate that transformer models achieve 15% higher accuracy on benchmark tasks compared to RNNs."}</params>
    </example>
  </tool>

  <tool name="add_task">
    <description>Add a task to your task list to track what needs to be done.</description>
    <parameters>
      <param name="task" type="string" required="true">Description of the task</param>
    </parameters>
  </tool>

  <tool name="complete_task">
    <description>Mark a task as completed.</description>
    <parameters>
      <param name="task_id" type="number" required="true">ID of the task to complete</param>
    </parameters>
  </tool>

  <tool name="finish">
    <description>Call this when you have found sufficient citations and are ready to return results.</description>
    <parameters>
      <param name="summary" type="string" required="true">Brief summary of what was found</param>
    </parameters>
  </tool>
</tools>
`;

const SYSTEM_PROMPT = `You are an academic research agent that finds real citations for claims. You operate in a ReAct (Reasoning + Acting) loop.

${TOOLS_XML}

<instructions>
  <rule>You MUST respond using XML tags for your reasoning and actions</rule>
  <rule>Always start with a <thought> to analyze the situation</rule>
  <rule>Then use <action> and <params> to call a tool</rule>
  <rule>After receiving <observation>, continue with another <thought></rule>
  <rule>Use the think tool liberally to reason through complex queries</rule>
  <rule>After searching, review the abstracts and use select_paper for relevant ones</rule>
  <rule>Provide a clear excerpt explaining HOW the paper supports the claim</rule>
  <rule>You may search multiple times with different queries to find better results</rule>
  <rule>Call finish when you have selected 3-5 good papers with excerpts</rule>
</instructions>

<response_format>
  <thought>Your reasoning about what to do next</thought>
  <action>tool_name</action>
  <params>{"param": "value"}</params>
</response_format>

<workflow>
  1. Analyze the claim - what concepts need academic support?
  2. Use think tool to plan your search strategy
  3. Search with specific academic terminology
  4. Review abstracts and select_paper for each relevant result with an excerpt
  5. If needed, search again with different terms
  6. Call finish when you have 3-5 papers with good excerpts
</workflow>`;

export interface CitationSuggestion {
  title: string;
  authors: string[];
  year?: number;
  url: string;
  excerpt: string;
  citationCount: number;
  source: string;
  doi?: string;
}

interface PaperWithAbstract {
  title: string;
  authors: string[];
  url: string;
  abstract: string;
  citationCount: number;
  source: string;
  doi: string;
}

interface Task {
  id: number;
  task: string;
  completed: boolean;
}

interface AgentState {
  claim: string;
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  iterations: number;
  selectedPapers: Map<string, CitationSuggestion>;
  lastSearchResults: PaperWithAbstract[];
  tasks: Task[];
  finished: boolean;
  finishSummary: string;
}

// Parse XML response from the model
function parseXmlResponse(content: string): {
  thought: string | null;
  action: string | null;
  params: Record<string, unknown> | null;
} {
  const thoughtMatch = content.match(/<thought>([\s\S]*?)<\/thought>/);
  const actionMatch = content.match(/<action>([\s\S]*?)<\/action>/);
  const paramsMatch = content.match(/<params>([\s\S]*?)<\/params>/);

  let params: Record<string, unknown> | null = null;
  if (paramsMatch) {
    try {
      params = JSON.parse(paramsMatch[1].trim());
    } catch {
      console.error("[ReAct] Failed to parse params:", paramsMatch[1]);
    }
  }

  return {
    thought: thoughtMatch ? thoughtMatch[1].trim() : null,
    action: actionMatch ? actionMatch[1].trim() : null,
    params,
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncateAbstract(abstract: string, maxLen: number = 300): string {
  if (abstract.length <= maxLen) return abstract;
  return abstract.slice(0, maxLen).trim() + "...";
}

// Execute a tool and return the observation
async function executeTool(
  action: string,
  params: Record<string, unknown>,
  state: AgentState,
): Promise<string> {
  switch (action) {
    case "think": {
      const thought = params.thought as string;
      console.log(`[ReAct] Think: ${thought.slice(0, 100)}...`);
      return `<observation>Thought recorded. Continue with your next action.</observation>`;
    }

    case "search_papers": {
      const query = params.query as string;
      console.log(`[ReAct] Searching: "${query}"`);

      try {
        const papers = await getResultsForQuery({ query });

        if (papers.length === 0) {
          state.lastSearchResults = [];
          return `<observation>No papers found for "${query}". Try different search terms.</observation>`;
        }

        // Store search results for select_paper
        state.lastSearchResults = papers.slice(0, 5).map((p) => ({
          title: p.title,
          authors: p.authors,
          url: p.url,
          abstract: p.abstract,
          citationCount: p.citationCount || 0,
          source: p.source,
          doi: p.doi,
        }));

        const resultXml = state.lastSearchResults
          .map(
            (p, i) => `
    <paper index="${i}">
      <title>${escapeXml(p.title)}</title>
      <authors>${escapeXml(p.authors.slice(0, 3).join(", "))}${p.authors.length > 3 ? " et al." : ""}</authors>
      <abstract>${escapeXml(truncateAbstract(p.abstract))}</abstract>
      <citations>${p.citationCount}</citations>
      <source>${escapeXml(p.source)}</source>
    </paper>`,
          )
          .join("");

        return `<observation>
  <results count="${papers.length}">${resultXml}
  </results>
  <instruction>Review the abstracts above. For relevant papers, use select_paper with an excerpt explaining how it supports the claim: "${state.claim}"</instruction>
</observation>`;
      } catch (error) {
        return `<observation>Search failed: ${error instanceof Error ? error.message : "Unknown error"}</observation>`;
      }
    }

    case "select_paper": {
      const paperIndex = params.paper_index as number;
      const excerpt = params.excerpt as string;

      if (paperIndex < 0 || paperIndex >= state.lastSearchResults.length) {
        return `<observation>Invalid paper index ${paperIndex}. Valid range: 0-${state.lastSearchResults.length - 1}</observation>`;
      }

      const paper = state.lastSearchResults[paperIndex];
      const key =
        paper.doi || paper.title.toLowerCase().replace(/[^a-z0-9]/g, "");

      if (state.selectedPapers.has(key)) {
        return `<observation>Paper already selected: "${paper.title}"</observation>`;
      }

      state.selectedPapers.set(key, {
        title: paper.title,
        authors: paper.authors,
        url: paper.doi ? `https://doi.org/${paper.doi}` : paper.url,
        excerpt: excerpt,
        citationCount: paper.citationCount,
        source: paper.source,
        doi: paper.doi || undefined,
      });

      console.log(
        `[ReAct] Selected paper ${paperIndex}: ${paper.title.slice(0, 50)}...`,
      );
      return `<observation>Paper selected: "${paper.title}". Total selected: ${state.selectedPapers.size}. ${state.selectedPapers.size >= 3 ? "You have enough papers - consider calling finish." : "Continue selecting or search for more."}</observation>`;
    }

    case "add_task": {
      const task: Task = {
        id: state.tasks.length + 1,
        task: params.task as string,
        completed: false,
      };
      state.tasks.push(task);
      console.log(`[ReAct] Added task ${task.id}: ${task.task}`);
      return `<observation>Task ${task.id} added: "${task.task}"</observation>`;
    }

    case "complete_task": {
      const taskId = params.task_id as number;
      const task = state.tasks.find((t) => t.id === taskId);
      if (task) {
        task.completed = true;
        console.log(`[ReAct] Completed task ${taskId}`);
        return `<observation>Task ${taskId} marked complete</observation>`;
      }
      return `<observation>Task ${taskId} not found</observation>`;
    }

    case "finish": {
      state.finished = true;
      state.finishSummary = params.summary as string;
      console.log(`[ReAct] Finishing: ${state.finishSummary}`);
      return `<observation>Agent finished. Results will be returned.</observation>`;
    }

    default:
      return `<observation>Unknown action: ${action}. Available actions: think, search_papers, select_paper, add_task, complete_task, finish</observation>`;
  }
}

// Main ReAct agent loop
async function runReActAgent(
  client: OpenAI,
  query: string,
): Promise<CitationSuggestion[]> {
  const MAX_ITERATIONS = 10;

  const state: AgentState = {
    claim: query,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `<request>
  <claim>${escapeXml(query)}</claim>
  <goal>Find 3-5 relevant academic papers that support this claim. For each paper, provide an excerpt from its abstract explaining how it supports the claim.</goal>
</request>

Begin by thinking about what this claim means and what kind of academic evidence would be relevant.`,
      },
    ],
    iterations: 0,
    selectedPapers: new Map(),
    lastSearchResults: [],
    tasks: [],
    finished: false,
    finishSummary: "",
  };

  while (state.iterations < MAX_ITERATIONS && !state.finished) {
    state.iterations++;
    console.log(
      `[ReAct] === Iteration ${state.iterations}/${MAX_ITERATIONS} ===`,
    );

    const response = await client.chat.completions.create({
      model: "meta-llama/llama-3.1-8b-instruct",
      max_tokens: 1000,
      temperature: 0.2,
      messages: state.messages,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      console.log("[ReAct] Empty response, breaking");
      break;
    }

    // Add assistant message
    state.messages.push({ role: "assistant", content });

    // Parse the XML response
    const { thought, action, params } = parseXmlResponse(content);

    if (thought) {
      console.log(`[ReAct] Thought: ${thought.slice(0, 150)}...`);
    }

    if (action && params) {
      // Execute the tool
      const observation = await executeTool(action, params, state);

      // Add observation as user message (simulating environment feedback)
      state.messages.push({ role: "user", content: observation });
    } else {
      // No valid action found - prompt to continue
      console.log("[ReAct] No valid action found in response");
      state.messages.push({
        role: "user",
        content: `<observation>Invalid response format. Please respond with <thought>, <action>, and <params> tags.</observation>`,
      });
    }

    // Safety check - if we have enough papers and many iterations, auto-finish
    if (
      state.iterations >= 6 &&
      state.selectedPapers.size >= 3 &&
      !state.finished
    ) {
      console.log(
        "[ReAct] Auto-finishing due to iteration limit with sufficient results",
      );
      state.finished = true;
    }
  }

  // Return selected papers sorted by citation count
  const citations = Array.from(state.selectedPapers.values());
  citations.sort((a, b) => b.citationCount - a.citationCount);

  console.log(
    `[ReAct] Final: ${citations.length} citations, ${state.iterations} iterations`,
  );
  if (state.finishSummary) {
    console.log(`[ReAct] Summary: ${state.finishSummary}`);
  }

  return citations.slice(0, 5);
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const client = getClient();
    const { query } = await request.json();

    if (!query || typeof query !== "string") {
      return json({ error: "Query is required" }, { status: 400 });
    }

    if (query.trim().length < 3) {
      return json(
        { error: "Query must be at least 3 characters" },
        { status: 400 },
      );
    }

    console.log(`[ReAct] Starting citation search for: "${query}"`);
    const citations = await runReActAgent(client, query);
    console.log(`[ReAct] Returning ${citations.length} citations`);

    return json({ citations });
  } catch (error) {
    console.error("Citation search error:", error);
    return json({ error: "Failed to search for citations" }, { status: 500 });
  }
};
