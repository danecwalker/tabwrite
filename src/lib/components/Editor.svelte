<script lang="ts">
	import { onMount } from 'svelte';
	import { createDebouncedFetcher } from '$lib/debounce';

	let editorElement: HTMLDivElement;
	let pendingSuggestion = $state('');
	let isLoading = $state(false);

	const fetcher = createDebouncedFetcher(500);
	const GHOST_CLASS = 'ghost-suggestion';

	function getTextContent(): string {
		// Get text content excluding ghost text
		const clone = editorElement.cloneNode(true) as HTMLElement;
		const ghostElements = clone.querySelectorAll(`.${GHOST_CLASS}`);
		ghostElements.forEach((el) => el.remove());
		return clone.innerText || '';
	}

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
