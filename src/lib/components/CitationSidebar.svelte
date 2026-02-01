<script lang="ts">
	import type { CitationClaim } from '../../routes/api/citations/+server';
	import type { CitationSuggestion } from '../../routes/api/citations/search/+server';

	interface ClaimWithSuggestions {
		claim: CitationClaim;
		suggestions: CitationSuggestion[];
		isLoading: boolean;
	}

	interface Props {
		claims: ClaimWithSuggestions[];
		isDetecting?: boolean;
		activeClaimIndex?: number | null;
		onAddCitation?: (claim: CitationClaim, suggestion: CitationSuggestion, claimIndex: number) => void;
		onRefresh?: () => void;
	}

	let { claims, isDetecting = false, activeClaimIndex = null, onAddCitation, onRefresh }: Props = $props();

	export function scrollToClaimByIndex(index: number) {
		const element = document.getElementById(`claim-${index}`);
		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}

	// Auto-scroll when activeClaimIndex changes
	$effect(() => {
		if (activeClaimIndex !== null && activeClaimIndex >= 0) {
			scrollToClaimByIndex(activeClaimIndex);
		}
	});
</script>

<aside class="sidebar">
	<header class="sidebar-header">
		<h2>Citations</h2>
		{#if isDetecting}
			<span class="detecting-badge">Scanning...</span>
		{/if}
		<button
			class="refresh-btn"
			onclick={() => onRefresh?.()}
			disabled={isDetecting}
			title="Refresh citations"
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class:spinning={isDetecting}>
				<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
				<path d="M21 3v5h-5" />
			</svg>
		</button>
	</header>

	<div class="sidebar-content">
		{#if claims.length === 0}
			<div class="empty-state">
				{#if isDetecting}
					<p>Analyzing text for claims that need citations...</p>
				{:else}
					<p>No citation suggestions yet.</p>
					<p class="empty-hint">Write some content and claims needing citations will appear here.</p>
				{/if}
			</div>
		{:else}
			<ul class="claims-list">
				{#each claims as { claim, suggestions, isLoading }, index (claim.startIndex)}
					<li class="claim-item" id="claim-{index}" class:active={activeClaimIndex === index}>
						<div class="claim-header">
							<span class="claim-number">{index + 1}</span>
							<p class="claim-text">"{claim.claim}"</p>
						</div>

						<div class="suggestions-container">
							{#if isLoading}
								<div class="suggestions-loading">
									<span class="loading-dot"></span>
									<span>Finding sources...</span>
								</div>
							{:else if suggestions.length === 0}
								<p class="no-suggestions">No sources found</p>
							{:else}
								<ul class="suggestions-list">
									{#each suggestions as suggestion (suggestion.url)}
										<li class="suggestion-item">
											<div class="suggestion-header">
												<a href={suggestion.url} target="_blank" rel="noopener noreferrer" class="suggestion-title">
													{suggestion.title}
												</a>
												<button
													class="add-btn"
													onclick={() => onAddCitation?.(claim, suggestion, index)}
													title="Add this citation"
												>
													Add
												</button>
											</div>
											<p class="suggestion-meta">
												{suggestion.authors.slice(0, 2).join(', ')}{suggestion.authors.length > 2 ? ' et al.' : ''}
												{#if suggestion.citationCount}
													<span class="citation-count">· {suggestion.citationCount} citations</span>
												{/if}
												<span class="suggestion-source">· {suggestion.source}</span>
											</p>
											{#if suggestion.excerpt}
												<p class="suggestion-excerpt">"{suggestion.excerpt}"</p>
											{/if}
										</li>
									{/each}
								</ul>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</aside>

<style>
	.sidebar {
		width: 320px;
		min-width: 320px;
		height: 100vh;
		background: #fafafa;
		border-left: 1px solid #e5e7eb;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.sidebar-header {
		padding: 1rem 1.25rem;
		border-bottom: 1px solid #e5e7eb;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: #ffffff;
	}

	.sidebar-header h2 {
		font-family: 'Georgia', 'Times New Roman', serif;
		font-size: 1rem;
		font-weight: 500;
		color: #374151;
		margin: 0;
		flex: 1;
	}

	.refresh-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		background: transparent;
		border: 1px solid #e5e7eb;
		border-radius: 0.375rem;
		color: #6b7280;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.refresh-btn:hover:not(:disabled) {
		background: #f3f4f6;
		color: #374151;
		border-color: #d1d5db;
	}

	.refresh-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.refresh-btn svg.spinning {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.detecting-badge {
		font-size: 0.75rem;
		color: #6366f1;
		background: #eef2ff;
		padding: 0.25rem 0.5rem;
		border-radius: 9999px;
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 0.7; }
		50% { opacity: 1; }
	}

	.sidebar-content {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
	}

	.empty-state {
		text-align: center;
		padding: 2rem 1rem;
		color: #6b7280;
	}

	.empty-state p {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.empty-hint {
		margin-top: 0.5rem !important;
		font-size: 0.8125rem !important;
		color: #9ca3af;
	}

	.claims-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.claim-item {
		background: #ffffff;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		overflow: hidden;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}

	.claim-item.active {
		border-color: #fde047;
		box-shadow: 0 0 0 2px #fef08a;
	}

	.claim-header {
		padding: 0.75rem 1rem;
		background: #f9fafb;
		border-bottom: 1px solid #e5e7eb;
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
	}

	.claim-number {
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
		background: #6366f1;
		color: #ffffff;
		font-size: 0.75rem;
		font-weight: 600;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.claim-text {
		margin: 0;
		font-size: 0.8125rem;
		line-height: 1.5;
		color: #374151;
		font-style: italic;
	}

	.suggestions-container {
		padding: 0.75rem 1rem;
	}

	.suggestions-loading {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #6b7280;
		font-size: 0.8125rem;
	}

	.loading-dot {
		width: 6px;
		height: 6px;
		background: #6366f1;
		border-radius: 50%;
		animation: pulse 1s ease-in-out infinite;
	}

	.no-suggestions {
		margin: 0;
		font-size: 0.8125rem;
		color: #9ca3af;
	}

	.suggestions-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.suggestion-item {
		padding-bottom: 0.75rem;
		border-bottom: 1px solid #f3f4f6;
	}

	.suggestion-item:last-child {
		padding-bottom: 0;
		border-bottom: none;
	}

	.suggestion-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.suggestion-title {
		flex: 1;
		font-size: 0.8125rem;
		font-weight: 500;
		color: #2563eb;
		text-decoration: none;
		line-height: 1.4;
	}

	.suggestion-title:hover {
		text-decoration: underline;
	}

	.add-btn {
		flex-shrink: 0;
		padding: 0.25rem 0.5rem;
		font-size: 0.6875rem;
		font-weight: 600;
		color: #ffffff;
		background: #6366f1;
		border: none;
		border-radius: 0.25rem;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.add-btn:hover {
		background: #4f46e5;
	}

	.add-btn:active {
		background: #4338ca;
	}

	.suggestion-meta {
		margin: 0;
		font-size: 0.75rem;
		color: #6b7280;
	}

	.suggestion-source {
		color: #9ca3af;
	}

	.citation-count {
		color: #6366f1;
		font-weight: 500;
	}

	.suggestion-excerpt {
		margin: 0.5rem 0 0;
		font-size: 0.75rem;
		color: #374151;
		line-height: 1.5;
		font-style: italic;
		background: #f9fafb;
		padding: 0.5rem;
		border-radius: 0.25rem;
		border-left: 2px solid #6366f1;
	}
</style>
