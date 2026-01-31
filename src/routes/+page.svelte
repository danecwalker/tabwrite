<script lang="ts">
	import { onMount } from 'svelte';
	import Editor from '$lib/components/Editor.svelte';
	import CitationSidebar from '$lib/components/CitationSidebar.svelte';
	import Bibliography from '$lib/components/Bibliography.svelte';
	import { createCitationDetector } from '$lib/debounce';
	import type { CitationClaim } from './api/citations/+server';
	import type { CitationSuggestion } from './api/citations/search/+server';

	interface ClaimWithSuggestions {
		claim: CitationClaim;
		suggestions: CitationSuggestion[];
		isLoading: boolean;
	}

	interface BibliographyEntry {
		number: number;
		suggestion: CitationSuggestion;
	}

	interface EditorRef {
		insertCitationAtIndex: (endIndex: number, citationNumber: number) => boolean;
		updateCitationNumbers: (oldToNew: Map<number, number>) => void;
		removeCitationByNumber: (citationNumber: number) => void;
		getText: () => string;
		getInlineCitationCount: () => number;
		getInlineCitationNumbers: () => number[];
	}

	let claimsWithSuggestions = $state<ClaimWithSuggestions[]>([]);
	let isDetecting = $state(false);
	let activeClaimIndex = $state<number | null>(null);
	let bibliography = $state<BibliographyEntry[]>([]);
	let editorRef = $state<EditorRef | null>(null);

	// Citation detector with 2-second debounce
	const citationDetector = createCitationDetector(2000);

	// Extract just the claims for the editor
	let claims = $derived(claimsWithSuggestions.map((c) => c.claim));

	// Fetch suggestions for a single claim
	async function fetchSuggestionsForClaim(claim: CitationClaim, index: number, signal: AbortSignal) {
		try {
			const response = await fetch('/api/citations/search', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ query: claim.searchQuery }),
				signal
			});

			if (response.ok) {
				const data = await response.json();
				// Update the specific claim with suggestions
				claimsWithSuggestions = claimsWithSuggestions.map((c, i) =>
					i === index ? { ...c, suggestions: data.suggestions || [], isLoading: false } : c
				);
			} else {
				claimsWithSuggestions = claimsWithSuggestions.map((c, i) =>
					i === index ? { ...c, suggestions: [], isLoading: false } : c
				);
			}
		} catch (e) {
			if (e instanceof Error && e.name !== 'AbortError') {
				console.error('Error fetching suggestions:', e);
				claimsWithSuggestions = claimsWithSuggestions.map((c, i) =>
					i === index ? { ...c, suggestions: [], isLoading: false } : c
				);
			}
		}
	}

	// Handle detection results
	function handleDetectionComplete(detectedClaims: CitationClaim[]) {
		isDetecting = false;

		if (detectedClaims.length === 0) {
			claimsWithSuggestions = [];
			return;
		}

		// Create abort controller for suggestion fetches
		const suggestionsAbortController = new AbortController();

		// Initialize claims with loading state
		claimsWithSuggestions = detectedClaims.map((claim) => ({
			claim,
			suggestions: [],
			isLoading: true
		}));

		// Fetch suggestions for each claim
		detectedClaims.forEach((claim, index) => {
			fetchSuggestionsForClaim(claim, index, suggestionsAbortController.signal);
		});
	}

	// Handle text changes from editor
	function handleTextChange() {
		if (!editorRef) return;
		const text = editorRef.getText();
		citationDetector.detect(text, {
			onStart: () => {
				isDetecting = true;
			},
			onComplete: handleDetectionComplete
		});
	}

	// Cleanup on unmount
	onMount(() => {
		return () => {
			citationDetector.cancel();
		};
	});

	function handleClaimClick(claim: CitationClaim, index: number) {
		activeClaimIndex = index;
		// Clear active state after a short delay
		setTimeout(() => {
			activeClaimIndex = null;
		}, 2000);
	}

	function handleAddCitation(claim: CitationClaim, suggestion: CitationSuggestion, claimIndex: number) {
		// Calculate next citation number
		const citationNumber = bibliography.length + 1;

		// Insert inline citation at the end of the claim
		const inserted = editorRef?.insertCitationAtIndex(claim.endIndex, citationNumber);

		if (inserted) {
			// Add to bibliography
			bibliography = [...bibliography, { number: citationNumber, suggestion }];

			// Remove the claim from the list (removes highlight)
			claimsWithSuggestions = claimsWithSuggestions.filter((_, i) => i !== claimIndex);
		}
	}

	function handleRemoveCitation(index: number) {
		const removedEntry = bibliography[index];
		const removedNumber = removedEntry.number;

		// Remove the inline citation from the editor
		editorRef?.removeCitationByNumber(removedNumber);

		// Remove from bibliography
		const newBibliography = bibliography.filter((_, i) => i !== index);

		// Create mapping for renumbering: old number -> new number
		const oldToNew = new Map<number, number>();
		newBibliography.forEach((entry, i) => {
			const newNumber = i + 1;
			if (entry.number !== newNumber) {
				oldToNew.set(entry.number, newNumber);
				entry.number = newNumber;
			}
		});

		// Update inline citations in the editor if needed
		if (oldToNew.size > 0) {
			editorRef?.updateCitationNumbers(oldToNew);
		}

		bibliography = newBibliography;
	}
</script>

<svelte:head>
	<title>TabWrite - AI-Powered Essay Writing</title>
	<meta name="description" content="Write essays with AI-powered tab-autocomplete suggestions" />
</svelte:head>

<main>
	<header>
		<h1>TabWrite</h1>
	</header>
	<div class="content-layout">
		<div class="editor-area">
			<Editor bind:this={editorRef} {claims} onClaimClick={handleClaimClick} onTextChange={handleTextChange} />
			<div class="bibliography-area">
				<Bibliography entries={bibliography} onRemove={handleRemoveCitation} />
			</div>
		</div>
		<CitationSidebar
			claims={claimsWithSuggestions}
			{isDetecting}
			{activeClaimIndex}
			onAddCitation={handleAddCitation}
		/>
	</div>
</main>

<style>
	main {
		min-height: 100vh;
		padding: 2rem;
		background: linear-gradient(to bottom, #fafafa, #ffffff);
	}

	header {
		text-align: center;
		margin-bottom: 2rem;
	}

	h1 {
		font-family: 'Georgia', 'Times New Roman', serif;
		font-size: 1.5rem;
		font-weight: 400;
		color: #374151;
		letter-spacing: 0.05em;
	}

	.content-layout {
		display: flex;
		gap: 0;
		max-width: 1200px;
		margin: 0 auto;
	}

	.editor-area {
		flex: 1;
		min-width: 0;
	}

	.bibliography-area {
		max-width: 700px;
		margin: 0 auto;
		padding: 0 2rem;
	}
</style>
