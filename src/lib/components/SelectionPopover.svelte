<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		editorElement: HTMLElement | null;
		onPromptClick: (selectedText: string, range: Range) => void;
	}

	let { editorElement, onPromptClick }: Props = $props();

	let isVisible = $state(false);
	let position = $state({ top: 0, left: 0 });
	let currentRange = $state<Range | null>(null);
	let selectedText = $state('');

	function updatePopoverPosition() {
		const selection = window.getSelection();
		if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
			isVisible = false;
			return;
		}

		const range = selection.getRangeAt(0);
		const text = selection.toString().trim();

		// Check if selection is within the editor
		if (!editorElement || !editorElement.contains(range.commonAncestorContainer)) {
			isVisible = false;
			return;
		}

		// Ignore very short selections
		if (text.length < 2) {
			isVisible = false;
			return;
		}

		// Store the range and text
		currentRange = range.cloneRange();
		selectedText = text;

		// Get bounding rect of selection
		const rect = range.getBoundingClientRect();

		// Position the popover above the selection, centered
		const popoverWidth = 80; // approximate width
		position = {
			top: rect.top + window.scrollY - 40,
			left: rect.left + window.scrollX + (rect.width / 2) - (popoverWidth / 2)
		};

		isVisible = true;
	}

	function handlePromptClick() {
		if (currentRange && selectedText) {
			onPromptClick(selectedText, currentRange);
			isVisible = false;
		}
	}

	function handleMouseDown(event: MouseEvent) {
		// Hide popover when clicking outside of it
		const target = event.target as HTMLElement;
		if (!target.closest('.selection-popover')) {
			isVisible = false;
		}
	}

	onMount(() => {
		document.addEventListener('selectionchange', updatePopoverPosition);
		document.addEventListener('mousedown', handleMouseDown);

		return () => {
			document.removeEventListener('selectionchange', updatePopoverPosition);
			document.removeEventListener('mousedown', handleMouseDown);
		};
	});
</script>

{#if isVisible}
	<div
		class="selection-popover"
		style="top: {position.top}px; left: {position.left}px;"
	>
		<button class="prompt-button" onclick={handlePromptClick}>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M12 2L2 7l10 5 10-5-10-5z"/>
				<path d="M2 17l10 5 10-5"/>
				<path d="M2 12l10 5 10-5"/>
			</svg>
			Prompt
		</button>
	</div>
{/if}

<style>
	.selection-popover {
		position: absolute;
		z-index: 1000;
		animation: fadeIn 0.15s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.prompt-button {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		background: #4f46e5;
		color: white;
		border: none;
		border-radius: 0.375rem;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		transition: background-color 0.15s, transform 0.1s;
	}

	.prompt-button:hover {
		background: #4338ca;
	}

	.prompt-button:active {
		transform: scale(0.97);
	}

	.prompt-button svg {
		flex-shrink: 0;
	}
</style>
