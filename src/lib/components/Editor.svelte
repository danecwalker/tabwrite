<script lang="ts">
	import { onMount } from 'svelte';
	import { createDebouncedFetcher } from '$lib/debounce';
	import type { CitationClaim } from '../../routes/api/citations/+server';

	interface Props {
		claims?: CitationClaim[];
		onClaimClick?: (claim: CitationClaim, index: number) => void;
		onTextChange?: () => void;
	}

	let { claims = [], onClaimClick, onTextChange }: Props = $props();

	let editorElement: HTMLDivElement;
	let pendingSuggestion = $state('');
	let isLoading = $state(false);

	const fetcher = createDebouncedFetcher(500);
	const GHOST_CLASS = 'ghost-suggestion';
	const HIGHLIGHT_CLASS = 'citation-highlight';
	const INLINE_CITATION_CLASS = 'inline-citation';

	function getTextContent(): string {
		// Get text content excluding ghost text and inline citations
		// (highlights are fine since we just read their text)
		const clone = editorElement.cloneNode(true) as HTMLElement;
		const ghostElements = clone.querySelectorAll(`.${GHOST_CLASS}`);
		ghostElements.forEach((el) => el.remove());
		// Also exclude inline citations so indices match the original text
		const citationElements = clone.querySelectorAll(`.${INLINE_CITATION_CLASS}`);
		citationElements.forEach((el) => el.remove());
		return clone.innerText || '';
	}

	// Expose text content getter for parent components
	export function getText(): string {
		return getTextContent();
	}

	// Update all inline citation numbers (for renumbering after deletion)
	export function updateCitationNumbers(oldToNew: Map<number, number>): void {
		const citations = editorElement.querySelectorAll(`.${INLINE_CITATION_CLASS}`);
		citations.forEach((citation) => {
			const text = citation.textContent || '';
			const match = text.match(/\[(\d+)\]/);
			if (match) {
				const oldNum = parseInt(match[1], 10);
				const newNum = oldToNew.get(oldNum);
				if (newNum !== undefined) {
					citation.textContent = `[${newNum}]`;
				}
			}
		});
	}

	// Remove an inline citation by its number
	export function removeCitationByNumber(citationNumber: number): void {
		const citations = editorElement.querySelectorAll(`.${INLINE_CITATION_CLASS}`);
		citations.forEach((citation) => {
			const text = citation.textContent || '';
			if (text === `[${citationNumber}]`) {
				citation.remove();
			}
		});
	}

	// Get the count of inline citations currently in the editor
	export function getInlineCitationCount(): number {
		return editorElement.querySelectorAll(`.${INLINE_CITATION_CLASS}`).length;
	}

	// Get all inline citation numbers currently in the editor (for state verification)
	export function getInlineCitationNumbers(): number[] {
		const citations = editorElement.querySelectorAll(`.${INLINE_CITATION_CLASS}`);
		const numbers: number[] = [];
		citations.forEach((citation) => {
			const text = citation.textContent || '';
			const match = text.match(/\[(\d+)\]/);
			if (match) {
				numbers.push(parseInt(match[1], 10));
			}
		});
		return numbers.sort((a, b) => a - b);
	}

	// Insert inline citation at a specific position (end of claim)
	export function insertCitationAtIndex(endIndex: number, citationNumber: number): boolean {
		const citationText = `[${citationNumber}]`;

		// First remove any existing highlights to work with clean text
		removeHighlights();

		const walker = document.createTreeWalker(
			editorElement,
			NodeFilter.SHOW_TEXT,
			{
				acceptNode: (node) => {
					// Skip ghost text and inline citations
					const parent = node.parentElement;
					if (parent?.classList.contains(GHOST_CLASS) ||
						parent?.classList.contains(INLINE_CITATION_CLASS)) {
						return NodeFilter.FILTER_REJECT;
					}
					return NodeFilter.FILTER_ACCEPT;
				}
			}
		);

		let currentOffset = 0;
		let node: Text | null;

		while ((node = walker.nextNode() as Text | null)) {
			const nodeLength = node.length;
			const nodeStart = currentOffset;
			const nodeEnd = currentOffset + nodeLength;

			// Check if this node contains our target position
			if (nodeStart <= endIndex && endIndex <= nodeEnd) {
				const relativeOffset = endIndex - nodeStart;

				// Split the text node at the insertion point
				if (relativeOffset < node.length) {
					node.splitText(relativeOffset);
				}

				// Create citation marker span
				const citationSpan = document.createElement('span');
				citationSpan.className = INLINE_CITATION_CLASS;
				citationSpan.textContent = citationText;
				citationSpan.contentEditable = 'false';

				// Insert after the current node
				const parent = node.parentNode;
				if (parent) {
					parent.insertBefore(citationSpan, node.nextSibling);
				}

				// Re-apply highlights for remaining claims
				applyHighlights();

				return true;
			}

			currentOffset += nodeLength;
		}

		return false;
	}

	function removeHighlights() {
		const highlights = editorElement.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
		highlights.forEach((el) => {
			const parent = el.parentNode;
			if (parent) {
				// Replace highlight span with its text content
				const textNode = document.createTextNode(el.textContent || '');
				parent.replaceChild(textNode, el);
				// Normalize to merge adjacent text nodes
				parent.normalize();
			}
		});
	}

	function applyHighlights() {
		if (!claims || claims.length === 0) return;

		// Save cursor position
		const selection = window.getSelection();
		let savedOffset = 0;
		let savedNode: Node | null = null;

		if (selection && selection.rangeCount > 0) {
			const range = selection.getRangeAt(0);
			savedNode = range.startContainer;
			savedOffset = range.startOffset;
		}

		// Remove existing highlights first
		removeHighlights();

		// Get the plain text content
		const text = getTextContent();

		// Sort claims by startIndex (descending) to apply from end to beginning
		// This prevents index shifting issues
		const sortedClaims = [...claims].sort((a, b) => b.startIndex - a.startIndex);

		// Apply highlights
		for (const claim of sortedClaims) {
			const { startIndex, endIndex } = claim;
			if (startIndex < 0 || endIndex > text.length || startIndex >= endIndex) continue;

			// Find the text node(s) containing this range
			const walker = document.createTreeWalker(
				editorElement,
				NodeFilter.SHOW_TEXT,
				{
					acceptNode: (node) => {
						// Skip ghost text and inline citations
						const parent = node.parentElement;
						if (parent?.classList.contains(GHOST_CLASS) ||
							parent?.classList.contains(INLINE_CITATION_CLASS)) {
							return NodeFilter.FILTER_REJECT;
						}
						return NodeFilter.FILTER_ACCEPT;
					}
				}
			);

			let currentOffset = 0;
			let node: Text | null;

			while ((node = walker.nextNode() as Text | null)) {
				const nodeLength = node.length;
				const nodeStart = currentOffset;
				const nodeEnd = currentOffset + nodeLength;

				// Check if this node contains the start of our highlight
				if (nodeStart <= startIndex && startIndex < nodeEnd) {
					const relativeStart = startIndex - nodeStart;
					const highlightLength = Math.min(endIndex - startIndex, nodeLength - relativeStart);

					// Split the text node if needed
					const claimIndex = claims.indexOf(claim);

					// Create highlight span
					const highlightSpan = document.createElement('span');
					highlightSpan.className = HIGHLIGHT_CLASS;
					highlightSpan.dataset.claimIndex = String(claimIndex);
					highlightSpan.addEventListener('click', () => {
						onClaimClick?.(claim, claimIndex);
					});

					// If highlight doesn't start at beginning of node, split
					if (relativeStart > 0) {
						node.splitText(relativeStart);
						node = node.nextSibling as Text;
					}

					// If highlight doesn't go to end of node, split
					if (highlightLength < node.length) {
						node.splitText(highlightLength);
					}

					// Wrap the node in highlight span
					const parent = node.parentNode;
					if (parent) {
						parent.insertBefore(highlightSpan, node);
						highlightSpan.appendChild(node);
					}

					break;
				}

				currentOffset += nodeLength;
			}
		}

		// Restore cursor position (simplified - just focus)
		editorElement.focus();
	}

	// Apply highlights when claims change
	$effect(() => {
		if (claims && editorElement) {
			applyHighlights();
		}
	});

	function removeGhostText() {
		const ghostElements = editorElement.querySelectorAll(`.${GHOST_CLASS}`);
		ghostElements.forEach((el) => el.remove());
		pendingSuggestion = '';
	}

	function insertGhostText(text: string) {
		removeGhostText();

		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return;

		const range = selection.getRangeAt(0);
		if (!range.collapsed) return;

		// Create ghost span
		const ghostSpan = document.createElement('span');
		ghostSpan.className = GHOST_CLASS;
		ghostSpan.textContent = text;
		ghostSpan.contentEditable = 'false';

		// Insert at cursor
		range.insertNode(ghostSpan);

		// Move cursor before the ghost span
		range.setStartBefore(ghostSpan);
		range.setEndBefore(ghostSpan);
		selection.removeAllRanges();
		selection.addRange(range);

		pendingSuggestion = text;
	}

	function acceptSuggestion() {
		const ghostElement = editorElement.querySelector(`.${GHOST_CLASS}`);
		if (!ghostElement || !pendingSuggestion) return;

		const text = pendingSuggestion;

		// Replace ghost span with actual text node
		const textNode = document.createTextNode(text);
		ghostElement.replaceWith(textNode);

		// Move cursor to end of inserted text
		const selection = window.getSelection();
		if (selection) {
			const range = document.createRange();
			range.setStartAfter(textNode);
			range.setEndAfter(textNode);
			selection.removeAllRanges();
			selection.addRange(range);
		}

		pendingSuggestion = '';

		// Trigger a new completion request
		handleInput();
	}

	function handleInput() {
		removeGhostText();
		isLoading = true;

		const text = getTextContent();

		// Notify parent of text change for citation detection
		onTextChange?.();

		if (text.length < 10) {
			isLoading = false;
			return;
		}

		fetcher.fetch(text, (completion) => {
			if (completion) {
				insertGhostText(completion);
			}
			isLoading = false;
		});
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Tab' && pendingSuggestion) {
			event.preventDefault();
			acceptSuggestion();
		} else if (event.key === 'Escape' && pendingSuggestion) {
			event.preventDefault();
			removeGhostText();
			fetcher.cancel();
			isLoading = false;
		} else if (pendingSuggestion && !event.ctrlKey && !event.metaKey && !event.altKey) {
			// Any other typing dismisses the ghost text
			if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') {
				removeGhostText();
			}
		}
	}

	function handleBeforeInput() {
		// Remove ghost text before any input happens
		if (pendingSuggestion) {
			removeGhostText();
		}
	}

	onMount(() => {
		editorElement.focus();
		return () => {
			fetcher.cancel();
		};
	});
</script>

<div class="editor-container">
	<div
		class="editor"
		bind:this={editorElement}
		contenteditable="true"
		oninput={handleInput}
		onkeydown={handleKeyDown}
		onbeforeinput={handleBeforeInput}
		role="textbox"
		tabindex="0"
		aria-multiline="true"
		aria-label="Essay editor"
	></div>

	{#if isLoading && !pendingSuggestion}
		<div class="loading-indicator">
			<span class="loading-dot"></span>
		</div>
	{/if}
</div>

<div class="hint">
	{#if pendingSuggestion}
		Press <kbd>Tab</kbd> to accept, <kbd>Esc</kbd> to dismiss
	{:else if isLoading}
		Thinking...
	{:else}
		Start writing to get AI suggestions
	{/if}
</div>

<style>
	.editor-container {
		position: relative;
		width: 100%;
		max-width: 700px;
		min-height: 70vh;
		margin: 0 auto;
	}

	.editor {
		width: 100%;
		min-height: 70vh;
		padding: 2rem;
		font-family: 'Georgia', 'Times New Roman', serif;
		font-size: 1.25rem;
		line-height: 1.8;
		color: #1a1a1a;
		background: transparent;
		border: none;
		outline: none;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.editor:empty::before {
		content: 'Start writing your essay...';
		color: #9ca3af;
		pointer-events: none;
	}

	.editor :global(.ghost-suggestion) {
		color: #9ca3af;
		pointer-events: none;
		user-select: none;
	}

	.editor :global(.citation-highlight) {
		background: linear-gradient(to bottom, transparent 85%, #fef08a 85%);
		cursor: pointer;
		border-radius: 1px;
	}

	.editor :global(.citation-highlight:hover) {
		background: linear-gradient(to bottom, transparent 85%, #fde047 85%);
	}

	.editor :global(.inline-citation) {
		color: #6366f1;
		font-size: 0.85em;
		font-weight: 600;
		vertical-align: super;
		font-family: ui-monospace, monospace;
		cursor: default;
		user-select: none;
	}

	.loading-indicator {
		position: absolute;
		bottom: 1rem;
		right: 1rem;
	}

	.loading-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		background: #6366f1;
		border-radius: 50%;
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.3;
			transform: scale(0.8);
		}
		50% {
			opacity: 1;
			transform: scale(1);
		}
	}

	.hint {
		position: fixed;
		bottom: 2rem;
		left: 50%;
		transform: translateX(-50%);
		font-size: 0.875rem;
		color: #6b7280;
		background: #f9fafb;
		padding: 0.5rem 1rem;
		border-radius: 9999px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	kbd {
		display: inline-block;
		padding: 0.125rem 0.375rem;
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		background: #e5e7eb;
		border-radius: 0.25rem;
		border: 1px solid #d1d5db;
	}
</style>
