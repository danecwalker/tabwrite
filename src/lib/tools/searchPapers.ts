import { json, type RequestHandler } from "@sveltejs/kit";
import axios from "axios";
import { parseStringPromise } from "xml2js";

// --- 1. Interfaces & Types ---

interface PaperData {
  title: string;
  authors: string[];
  url: string;
  pdfUrl?: string | null;
  source: string;
  citationCount: number;
  doi?: string;
  abstract?: string;
}

// Interface for what the Arxiv XML looks like (simplified)
interface ArxivEntry {
  id: string;
  title: string;
  summary: string;
  author: { name: string }[] | { name: string };
  link:
    | { $: { title?: string; href: string; type?: string } }[]
    | { $: { href: string } };
  "arxiv:doi"?: { _: string };
}

// Interface for Semantic Scholar JSON
interface S2Paper {
  title: string;
  authors: { name: string }[];
  url: string;
  citationCount: number;
  externalIds: { DOI?: string };
  abstract?: string;
}

// --- 2. The Data Model ---

class Paper implements PaperData {
  title: string;
  authors: string[];
  url: string;
  pdfUrl: string | null;
  source: string;
  citationCount: number;
  doi: string;
  abstract: string;
  cleanTitle: string;

  constructor(data: PaperData) {
    this.title = data.title;
    this.authors = data.authors;
    this.url = data.url;
    this.pdfUrl = data.pdfUrl || null;
    this.source = data.source;
    this.citationCount = data.citationCount;
    this.doi = data.doi || "";
    this.abstract = data.abstract || "";

    // Normalize for merging (remove non-alphanumeric, lowercase)
    this.cleanTitle = this.title.toLowerCase().replace(/[^a-z0-9]/g, "");
  }
}

interface Adapter {
  search(query: string): Promise<Paper[]>;
}

// --- 3. The Adapters ---

class ArxivAdapter implements Adapter {
  private baseUrl = "http://export.arxiv.org/api/query";

  async search(query: string): Promise<Paper[]> {
    try {
      const params = {
        search_query: `all:${query}`,
        start: 0,
        max_results: 5,
      };

      const response = await axios.get(this.baseUrl, { params });

      // Parse XML
      const result = await parseStringPromise(response.data, {
        explicitArray: false,
      });

      // Handle cases where result is empty or has only 1 entry (not an array)
      const rawEntries = result.feed.entry;
      if (!rawEntries) return [];

      const entries: ArxivEntry[] = Array.isArray(rawEntries)
        ? rawEntries
        : [rawEntries];

      return entries.map((entry: ArxivEntry) => {
        // Extract PDF link
        const links = Array.isArray(entry.link) ? entry.link : [entry.link];
        // @ts-ignore: xml2js types can be tricky with attributes ($)
        const pdfObj = links.find((l: any) => l.$ && l.$.title === "pdf");
        // @ts-ignore
        const pdfLink = pdfObj ? pdfObj.$.href : null;

        // Extract Authors
        let authors: string[] = [];
        if (Array.isArray(entry.author)) {
          authors = entry.author.map((a) => a.name);
        } else {
          authors = [entry.author.name];
        }

        return new Paper({
          title: entry.title.replace(/\n/g, " ").trim(),
          authors: authors,
          url: entry.id,
          pdfUrl: pdfLink,
          source: "arXiv",
          citationCount: 0, // arXiv doesn't provide citation counts
          // Access the DOi if it exists in the XML namespace
          doi: entry["arxiv:doi"] ? entry["arxiv:doi"]["_"] : "",
          abstract: entry.summary ? entry.summary.replace(/\n/g, " ").trim() : "",
        });
      });
    } catch (error) {
      console.error(
        "arXiv Error:",
        error instanceof Error ? error.message : error,
      );
      return [];
    }
  }
}

class SemanticScholarAdapter implements Adapter {
  private baseUrl = "https://api.semanticscholar.org/graph/v1/paper/search";

  async search(query: string): Promise<Paper[]> {
    try {
      const params = {
        query: query,
        limit: 5,
        fields: "title,authors,url,citationCount,externalIds,abstract",
      };

      const response = await axios.get(this.baseUrl, { params });
      const data = response.data.data as S2Paper[];

      if (!data) return [];

      return data.map((item) => {
        return new Paper({
          title: item.title,
          authors: item.authors ? item.authors.map((a) => a.name) : [],
          url: item.url,
          source: "Semantic Scholar",
          citationCount: item.citationCount || 0,
          doi: item.externalIds ? item.externalIds.DOI : undefined,
          abstract: item.abstract || "",
        });
      });
    } catch (error) {
      console.error(
        "S2 Error:",
        error instanceof Error ? error.message : error,
      );
      return [];
    }
  }
}

// --- 4. The Merger Logic ---

function mergeResults(resultsLists: Paper[][]): Paper[] {
  const merged = new Map<string, Paper>();
  const allPapers = resultsLists.flat();

  allPapers.forEach((paper) => {
    // Key Strategy: DOI is the gold standard. Fallback to clean title.
    const key = paper.doi ? paper.doi : paper.cleanTitle;
    if (!key) return;

    if (merged.has(key)) {
      const existing = merged.get(key)!;

      // 1. PDF Priority: Always prefer the version with a PDF link
      if (paper.pdfUrl && !existing.pdfUrl) {
        existing.pdfUrl = paper.pdfUrl;
      }

      // 2. Citation Priority: Always take the higher count (S2 usually wins)
      if (paper.citationCount > existing.citationCount) {
        existing.citationCount = paper.citationCount;
      }

      // 3. Source Tracking: Append source if new
      if (!existing.source.includes(paper.source)) {
        existing.source += `, ${paper.source}`;
      }

      // 4. DOI Backfill: If we matched on title but the new one has a DOI, save it
      if (!existing.doi && paper.doi) {
        existing.doi = paper.doi;
      }

      // 5. Abstract Backfill: Prefer longer abstract
      if (paper.abstract && paper.abstract.length > existing.abstract.length) {
        existing.abstract = paper.abstract;
      }
    } else {
      merged.set(key, paper);
    }
  });

  return Array.from(merged.values());
}

export const getResultsForQuery = async ({ query }: { query: string }) => {
  const adapters: Adapter[] = [
    new ArxivAdapter(),
    new SemanticScholarAdapter(),
  ];

  // Fire requests in parallel
  const promiseList = adapters.map((adapter) => adapter.search(query));
  const results = await Promise.all(promiseList);

  const flatCount = results.flat().length;
  console.log(`Received ${flatCount} raw results. Merging...`);

  // Merge and Sort
  const finalPapers = mergeResults(results);
  finalPapers.sort((a, b) => b.citationCount - a.citationCount);
  return finalPapers;
};
