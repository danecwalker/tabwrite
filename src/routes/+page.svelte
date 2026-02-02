<script lang="ts">
	import { onMount } from 'svelte';
	import Editor from '$lib/components/Editor.svelte';
	import CitationSidebar from '$lib/components/CitationSidebar.svelte';
	import Bibliography from '$lib/components/Bibliography.svelte';
	import SelectionPopover from '$lib/components/SelectionPopover.svelte';
	import PromptModal from '$lib/components/PromptModal.svelte';
	import { createCitationDetector } from '$lib/debounce';
	import type { CitationClaim } from './api/citations/+server';
	import type { CitationSuggestion } from './api/citations/search/+server';
	import type { BibliographyStyle } from '$lib/utils/bibliographyFormatter';
	import type { ActionType } from './api/prompt/+server';

	interface ClaimWithSuggestions {
		claim: CitationClaim;
		suggestions: CitationSuggestion[];
		isLoading: boolean;
	}

	interface BibliographyEntry {
		number: number;
		suggestion: CitationSuggestion;
		citedText?: string; // Track the text that was cited
	}

	interface EditorRef {
		insertCitationAtIndex: (endIndex: number, citationNumber: number) => boolean;
		updateCitationNumbers: (oldToNew: Map<number, number>) => void;
		removeCitationByNumber: (citationNumber: number) => void;
		getText: () => string;
		getInlineCitationCount: () => number;
		getInlineCitationNumbers: () => number[];
		getEditorElement: () => HTMLDivElement;
		replaceTextAtRange: (range: Range, newText: string) => boolean;
		insertTextAfterRange: (range: Range, text: string) => boolean;
	}

	let claimsWithSuggestions = $state<ClaimWithSuggestions[]>([]);
	let isDetecting = $state(false);
	let activeClaimIndex = $state<number | null>(null);
	let bibliography = $state<BibliographyEntry[]>([]);
	let bibStyle = $state<BibliographyStyle>('apa');
	let editorRef = $state<EditorRef | null>(null);

	// Prompt feature state
	let showPromptModal = $state(false);
	let selectedTextInfo = $state<{ text: string; range: Range } | null>(null);
	let isPromptProcessing = $state(false);

	let editorElement = $derived(editorRef?.getEditorElement() ?? null);

	const citationDetector = createCitationDetector(2000);

	let claims = $derived(claimsWithSuggestions.map((c) => c.claim));

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
				claimsWithSuggestions = claimsWithSuggestions.map((c, i) =>
					i === index ? { ...c, suggestions: data.citations || [], isLoading: false } : c
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

	function handleDetectionComplete(detectedClaims: CitationClaim[]) {
		isDetecting = false;

		if (detectedClaims.length === 0) {
			claimsWithSuggestions = [];
			return;
		}

		// Filter out claims that have already been cited
		const citedTexts = new Set(bibliography.map((b) => b.citedText).filter(Boolean));
		const filteredClaims = detectedClaims.filter((claim) => {
			const claimText = claim.claim.toLowerCase().trim();
			// Check if this claim text (or very similar) is already cited
			for (const citedText of citedTexts) {
				if (citedText && (
					claimText === citedText ||
					claimText.includes(citedText) ||
					citedText.includes(claimText)
				)) {
					return false;
				}
			}
			return true;
		});

		if (filteredClaims.length === 0) {
			claimsWithSuggestions = [];
			return;
		}

		const suggestionsAbortController = new AbortController();

		claimsWithSuggestions = filteredClaims.map((claim) => ({
			claim,
			suggestions: [],
			isLoading: true
		}));

		filteredClaims.forEach((claim, index) => {
			fetchSuggestionsForClaim(claim, index, suggestionsAbortController.signal);
		});
	}

	function handleTextChange() {
		// Citation AI disabled for now
		// if (!editorRef) return;
		// const text = editorRef.getText();
		// citationDetector.detect(text, {
		// 	onStart: () => {
		// 		isDetecting = true;
		// 	},
		// 	onComplete: handleDetectionComplete
		// });
	}

	function handleRefresh() {
		if (!editorRef || isDetecting) return;
		const text = editorRef.getText();
		if (text.length < 50) return;

		citationDetector.cancel();
		isDetecting = true;

		fetch('/api/citations', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text })
		})
			.then((res) => res.json())
			.then((data) => {
				handleDetectionComplete(data.claims || []);
			})
			.catch((err) => {
				console.error('Refresh error:', err);
				isDetecting = false;
			});
	}

	onMount(() => {
		return () => {
			citationDetector.cancel();
		};
	});

	function handleClaimClick(claim: CitationClaim, index: number) {
		activeClaimIndex = index;
		setTimeout(() => {
			activeClaimIndex = null;
		}, 2000);
	}

	function handleAddCitation(claim: CitationClaim, suggestion: CitationSuggestion, claimIndex: number) {
		const citationNumber = bibliography.length + 1;
		const inserted = editorRef?.insertCitationAtIndex(claim.endIndex, citationNumber);

		if (inserted) {
			// Store the cited text to prevent re-detecting it
			bibliography = [...bibliography, {
				number: citationNumber,
				suggestion,
				citedText: claim.claim.toLowerCase().trim()
			}];
			// Remove the claim from the list - this will trigger re-rendering and remove the highlight
			claimsWithSuggestions = claimsWithSuggestions.filter((_, i) => i !== claimIndex);
		}
	}

	function handleRemoveCitation(index: number) {
		const removedEntry = bibliography[index];
		const removedNumber = removedEntry.number;

		editorRef?.removeCitationByNumber(removedNumber);

		const newBibliography = bibliography.filter((_, i) => i !== index);

		const oldToNew = new Map<number, number>();
		newBibliography.forEach((entry, i) => {
			const newNumber = i + 1;
			if (entry.number !== newNumber) {
				oldToNew.set(entry.number, newNumber);
				entry.number = newNumber;
			}
		});

		if (oldToNew.size > 0) {
			editorRef?.updateCitationNumbers(oldToNew);
		}

		bibliography = newBibliography;
	}

	function handleBibStyleChange(style: BibliographyStyle) {
		bibStyle = style;
	}

	// Prompt feature handlers
	function handlePromptClick(text: string, range: Range) {
		selectedTextInfo = { text, range };
		showPromptModal = true;
	}

	function handlePromptClose() {
		showPromptModal = false;
		selectedTextInfo = null;
	}

	async function handlePromptSubmit(instruction: string, actionType: ActionType) {
		if (!selectedTextInfo || !editorRef) return;

		isPromptProcessing = true;

		try {
			// Get document text for style/context reference
			const documentContext = editorRef.getText();

			const response = await fetch('/api/prompt', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					selectedText: selectedTextInfo.text,
					instruction,
					actionType,
					documentContext
				})
			});

			if (!response.ok) {
				throw new Error('Failed to process prompt');
			}

			const data = await response.json();
			const result = data.result;

			// Apply the result based on action type
			if (actionType === 'rewrite' || actionType === 'expand' || actionType === 'summarize') {
				// Replace the selected text
				editorRef.replaceTextAtRange(selectedTextInfo.range, result);
			} else {
				// Insert after selection (analyze, custom by default)
				editorRef.insertTextAfterRange(selectedTextInfo.range, result);
			}

			handlePromptClose();
		} catch (error) {
			console.error('Prompt error:', error);
			alert('Failed to process your request. Please try again.');
		} finally {
			isPromptProcessing = false;
		}
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
	<div class="editor-area">
		<Editor
			bind:this={editorRef}
			{claims}
			{bibliography}
			{bibStyle}
			onClaimClick={handleClaimClick}
			onTextChange={handleTextChange}
			onBibStyleChange={handleBibStyleChange}
		/>
		<div class="bibliography-area">
			<Bibliography entries={bibliography} style={bibStyle} onRemove={handleRemoveCitation} />
		</div>
	</div>
	<div class="sidebar-container">
		<CitationSidebar
			claims={claimsWithSuggestions}
			{isDetecting}
			{activeClaimIndex}
			onAddCitation={handleAddCitation}
			onRefresh={handleRefresh}
		/>
	</div>

	<!-- Prompt feature components -->
	<SelectionPopover {editorElement} onPromptClick={handlePromptClick} />
	<PromptModal
		isOpen={showPromptModal}
		selectedText={selectedTextInfo?.text ?? ''}
		isProcessing={isPromptProcessing}
		onClose={handlePromptClose}
		onSubmit={handlePromptSubmit}
	/>
</main>

<style>
	main {
		min-height: 100vh;
		padding: 1.5rem;
		padding-right: 340px;
		background: #d1d5db;
	}

	header {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	h1 {
		font-family: 'Georgia', 'Times New Roman', serif;
		font-size: 1.5rem;
		font-weight: 400;
		color: #374151;
		letter-spacing: 0.05em;
	}

	.editor-area {
		max-width: 900px;
		margin: 0 auto;
	}

	.bibliography-area {
		max-width: 816px;
		margin: 1.5rem auto 0;
	}

	.sidebar-container {
		position: fixed;
		top: 0;
		right: 0;
		height: 100vh;
		z-index: 100;
	}
</style>
