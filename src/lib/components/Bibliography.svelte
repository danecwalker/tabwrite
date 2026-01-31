<script lang="ts">
	import type { CitationSuggestion } from '../../routes/api/citations/search/+server';

	interface BibliographyEntry {
		number: number;
		suggestion: CitationSuggestion;
	}

	interface Props {
		entries: BibliographyEntry[];
		onRemove?: (index: number) => void;
	}

	let { entries, onRemove }: Props = $props();
</script>

{#if entries.length > 0}
	<section class="bibliography">
		<header class="bibliography-header">
			<h3>Bibliography</h3>
			<span class="entry-count">{entries.length} {entries.length === 1 ? 'source' : 'sources'}</span>
		</header>
		<ol class="bibliography-list">
			{#each entries as entry, index (entry.suggestion.url)}
				<li class="bibliography-entry">
					<span class="entry-number">[{entry.number}]</span>
					<div class="entry-content">
						<span class="entry-authors">
							{entry.suggestion.authors.join(', ')}.
						</span>
						<span class="entry-title">
							<a href={entry.suggestion.url} target="_blank" rel="noopener noreferrer">
								{entry.suggestion.title}
							</a>.
						</span>
						<span class="entry-year">{entry.suggestion.year}.</span>
						<span class="entry-url">
							{entry.suggestion.url}
						</span>
					</div>
					<button
						class="remove-btn"
						onclick={() => onRemove?.(index)}
						title="Remove citation"
						aria-label="Remove citation {entry.number}"
					>
						×
					</button>
				</li>
			{/each}
		</ol>
	</section>
{/if}

<style>
	.bibliography {
		background: #ffffff;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		margin-top: 1.5rem;
	}

	.bibliography-header {
		padding: 0.75rem 1rem;
		background: #f9fafb;
		border-bottom: 1px solid #e5e7eb;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.bibliography-header h3 {
		margin: 0;
		font-family: 'Georgia', 'Times New Roman', serif;
		font-size: 0.9375rem;
		font-weight: 500;
		color: #374151;
	}

	.entry-count {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.bibliography-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.bibliography-entry {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #f3f4f6;
		transition: background 0.15s ease;
	}

	.bibliography-entry:last-child {
		border-bottom: none;
	}

	.bibliography-entry:hover {
		background: #f9fafb;
	}

	.entry-number {
		flex-shrink: 0;
		font-family: 'Georgia', 'Times New Roman', serif;
		font-size: 0.8125rem;
		font-weight: 600;
		color: #6366f1;
		min-width: 2rem;
	}

	.entry-content {
		flex: 1;
		font-size: 0.8125rem;
		line-height: 1.5;
		color: #374151;
	}

	.entry-authors {
		color: #374151;
	}

	.entry-title {
		font-style: italic;
	}

	.entry-title a {
		color: #2563eb;
		text-decoration: none;
	}

	.entry-title a:hover {
		text-decoration: underline;
	}

	.entry-year {
		color: #6b7280;
	}

	.entry-url {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.75rem;
		color: #9ca3af;
		word-break: break-all;
	}

	.remove-btn {
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
		padding: 0;
		font-size: 1.125rem;
		font-weight: 400;
		color: #9ca3af;
		background: transparent;
		border: none;
		border-radius: 0.25rem;
		cursor: pointer;
		transition: color 0.15s ease, background 0.15s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.remove-btn:hover {
		color: #ef4444;
		background: #fef2f2;
	}

	.remove-btn:active {
		background: #fee2e2;
	}
</style>
