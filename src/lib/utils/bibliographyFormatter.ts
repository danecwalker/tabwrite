import type { CitationSuggestion } from "../../routes/api/citations/search/+server";

export type BibliographyStyle = "apa" | "mla" | "chicago" | "ieee" | "harvard";

interface BibEntry {
  number: number;
  suggestion: CitationSuggestion;
}

function getDisplayUrl(suggestion: CitationSuggestion): { url: string; display: string } {
  if (suggestion.doi) {
    const doiUrl = `https://doi.org/${suggestion.doi}`;
    return { url: doiUrl, display: doiUrl };
  }
  return { url: suggestion.url, display: suggestion.url };
}

function formatAuthorsAPA(authors: string[]): string {
  if (authors.length === 0) return "";
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
  if (authors.length <= 7) {
    return authors.slice(0, -1).join(", ") + ", & " + authors[authors.length - 1];
  }
  return authors.slice(0, 6).join(", ") + ", ... " + authors[authors.length - 1];
}

function formatAuthorsMLA(authors: string[]): string {
  if (authors.length === 0) return "";
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} and ${authors[1]}`;
  return `${authors[0]}, et al.`;
}

function formatAuthorsChicago(authors: string[]): string {
  if (authors.length === 0) return "";
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} and ${authors[1]}`;
  if (authors.length === 3) {
    return `${authors[0]}, ${authors[1]}, and ${authors[2]}`;
  }
  return `${authors[0]} et al.`;
}

function formatAuthorsIEEE(authors: string[]): string {
  if (authors.length === 0) return "";
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} and ${authors[1]}`;
  return authors.slice(0, -1).join(", ") + ", and " + authors[authors.length - 1];
}

function formatAuthorsHarvard(authors: string[]): string {
  if (authors.length === 0) return "";
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} and ${authors[1]}`;
  if (authors.length === 3) {
    return `${authors[0]}, ${authors[1]} and ${authors[2]}`;
  }
  return `${authors[0]} et al.`;
}

export function formatCitation(
  entry: BibEntry,
  style: BibliographyStyle
): { formatted: string; html: string } {
  const { suggestion } = entry;
  const { title, authors, source } = suggestion;
  const { url, display } = getDisplayUrl(suggestion);
  const year = suggestion.year || new Date().getFullYear();

  switch (style) {
    case "apa": {
      // APA: Author, A. A. (Year). Title of work. Source. URL
      const authorStr = formatAuthorsAPA(authors);
      const formatted = `${authorStr} (${year}). ${title}. ${source}. ${display}`;
      const html = `${authorStr} (${year}). <em>${title}</em>. ${source}. <a href="${url}" target="_blank">${display}</a>`;
      return { formatted, html };
    }

    case "mla": {
      // MLA: Author(s). "Title." Source, Year. URL.
      const authorStr = formatAuthorsMLA(authors);
      const formatted = `${authorStr}. "${title}." ${source}, ${year}. ${display}.`;
      const html = `${authorStr}. "${title}." <em>${source}</em>, ${year}. <a href="${url}" target="_blank">${display}</a>.`;
      return { formatted, html };
    }

    case "chicago": {
      // Chicago: Author(s). "Title." Source. Accessed [date]. URL.
      const authorStr = formatAuthorsChicago(authors);
      const accessDate = new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      const formatted = `${authorStr}. "${title}." ${source}. Accessed ${accessDate}. ${display}.`;
      const html = `${authorStr}. "${title}." <em>${source}</em>. Accessed ${accessDate}. <a href="${url}" target="_blank">${display}</a>.`;
      return { formatted, html };
    }

    case "ieee": {
      // IEEE: [#] A. Author, "Title," Source, year. [Online]. Available: URL
      const authorStr = formatAuthorsIEEE(authors);
      const formatted = `[${entry.number}] ${authorStr}, "${title}," ${source}, ${year}. [Online]. Available: ${display}`;
      const html = `[${entry.number}] ${authorStr}, "${title}," <em>${source}</em>, ${year}. [Online]. Available: <a href="${url}" target="_blank">${display}</a>`;
      return { formatted, html };
    }

    case "harvard": {
      // Harvard: Author(s) (Year) Title. Source. Available at: URL (Accessed: date).
      const authorStr = formatAuthorsHarvard(authors);
      const accessDate = new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const formatted = `${authorStr} (${year}) ${title}. ${source}. Available at: ${display} (Accessed: ${accessDate}).`;
      const html = `${authorStr} (${year}) <em>${title}</em>. ${source}. Available at: <a href="${url}" target="_blank">${display}</a> (Accessed: ${accessDate}).`;
      return { formatted, html };
    }

    default:
      return { formatted: title, html: title };
  }
}

export function formatBibliography(
  entries: BibEntry[],
  style: BibliographyStyle
): { text: string; html: string } {
  if (entries.length === 0) return { text: "", html: "" };

  const formatted = entries.map((entry) => formatCitation(entry, style));

  // For IEEE, entries are already numbered in the citation
  // For others, we'll use a numbered list
  if (style === "ieee") {
    return {
      text: formatted.map((f) => f.formatted).join("\n\n"),
      html: formatted.map((f) => `<p>${f.html}</p>`).join(""),
    };
  }

  return {
    text: formatted.map((f, i) => `[${i + 1}] ${f.formatted}`).join("\n\n"),
    html: formatted.map((f, i) => `<p>[${i + 1}] ${f.html}</p>`).join(""),
  };
}
