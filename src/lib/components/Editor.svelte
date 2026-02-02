<script lang="ts">
	import { onMount } from 'svelte';
	import { createDebouncedFetcher } from '$lib/debounce';
	import EditorToolbar from './EditorToolbar.svelte';
	import { formatBibliography, type BibliographyStyle } from '$lib/utils/bibliographyFormatter';
	import type { CitationClaim } from '../../routes/api/citations/+server';
	import type { CitationSuggestion } from '../../routes/api/citations/search/+server';

	interface BibEntry {
		number: number;
		suggestion: CitationSuggestion;
	}

	interface Props {
		claims?: CitationClaim[];
		bibliography?: BibEntry[];
		onClaimClick?: (claim: CitationClaim, index: number) => void;
		onTextChange?: () => void;
		documentTitle?: string;
		bibStyle?: BibliographyStyle;
		onBibStyleChange?: (style: BibliographyStyle) => void;
	}

	let {
		claims = [],
		bibliography = [],
		onClaimClick,
		onTextChange,
		documentTitle = 'Untitled Document',
		bibStyle = 'apa',
		onBibStyleChange
	}: Props = $props();

	let isExporting = $state(false);
	let currentFont = $state('Georgia');
	let editorElement: HTMLDivElement;
	let pendingSuggestion = $state('');
	let isLoading = $state(false);

	const fetcher = createDebouncedFetcher(500);
	const GHOST_CLASS = 'ghost-suggestion';
	const HIGHLIGHT_CLASS = 'citation-highlight';
	const INLINE_CITATION_CLASS = 'inline-citation';

	// A4 page dimensions (in pixels at 96dpi)
	const PAGE_WIDTH = 816; // 8.5 inches
	const PAGE_HEIGHT = 1056; // 11 inches
	const PAGE_PADDING = 96; // 1 inch margins

	function getTextContent(): string {
		const clone = editorElement.cloneNode(true) as HTMLElement;
		clone.querySelectorAll(`.${GHOST_CLASS}`).forEach((el) => el.remove());
		clone.querySelectorAll(`.${INLINE_CITATION_CLASS}`).forEach((el) => el.remove());
		return clone.innerText || '';
	}

	export function getText(): string {
		return getTextContent();
	}

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

	export function removeCitationByNumber(citationNumber: number): void {
		const citations = editorElement.querySelectorAll(`.${INLINE_CITATION_CLASS}`);
		citations.forEach((citation) => {
			if (citation.textContent === `[${citationNumber}]`) {
				citation.remove();
			}
		});
	}

	export function getInlineCitationCount(): number {
		return editorElement.querySelectorAll(`.${INLINE_CITATION_CLASS}`).length;
	}

	export function getInlineCitationNumbers(): number[] {
		const citations = editorElement.querySelectorAll(`.${INLINE_CITATION_CLASS}`);
		const numbers: number[] = [];
		citations.forEach((citation) => {
			const match = (citation.textContent || '').match(/\[(\d+)\]/);
			if (match) numbers.push(parseInt(match[1], 10));
		});
		return numbers.sort((a, b) => a - b);
	}

	export function getEditorElement(): HTMLDivElement {
		return editorElement;
	}

	export function replaceTextAtRange(range: Range, newText: string): boolean {
		if (!editorElement.contains(range.commonAncestorContainer)) {
			return false;
		}

		try {
			// Delete the selected range content
			range.deleteContents();

			// Create a text node with the new content
			const textNode = document.createTextNode(newText);
			range.insertNode(textNode);

			// Move cursor to end of inserted text
			const selection = window.getSelection();
			if (selection) {
				const newRange = document.createRange();
				newRange.setStartAfter(textNode);
				newRange.setEndAfter(textNode);
				selection.removeAllRanges();
				selection.addRange(newRange);
			}

			// Normalize to merge adjacent text nodes
			editorElement.normalize();
			onTextChange?.();
			return true;
		} catch (e) {
			console.error('Failed to replace text:', e);
			return false;
		}
	}

	export function insertTextAfterRange(range: Range, text: string): boolean {
		if (!editorElement.contains(range.commonAncestorContainer)) {
			return false;
		}

		try {
			// Collapse range to end
			range.collapse(false);

			// Insert a paragraph break and then the text
			const wrapper = document.createElement('div');
			wrapper.innerHTML = '<br><br>' + text.replace(/\n/g, '<br>');

			const fragment = document.createDocumentFragment();
			while (wrapper.firstChild) {
				fragment.appendChild(wrapper.firstChild);
			}

			range.insertNode(fragment);

			// Move cursor to end
			const selection = window.getSelection();
			if (selection) {
				selection.collapseToEnd();
			}

			editorElement.normalize();
			onTextChange?.();
			return true;
		} catch (e) {
			console.error('Failed to insert text:', e);
			return false;
		}
	}

	export function insertCitationAtIndex(endIndex: number, citationNumber: number): boolean {
		removeHighlights();

		const walker = document.createTreeWalker(editorElement, NodeFilter.SHOW_TEXT, {
			acceptNode: (node) => {
				const parent = node.parentElement;
				if (parent?.classList.contains(GHOST_CLASS) || parent?.classList.contains(INLINE_CITATION_CLASS)) {
					return NodeFilter.FILTER_REJECT;
				}
				return NodeFilter.FILTER_ACCEPT;
			}
		});

		let currentOffset = 0;
		let node: Text | null;

		while ((node = walker.nextNode() as Text | null)) {
			const nodeStart = currentOffset;
			const nodeEnd = currentOffset + node.length;

			if (nodeStart <= endIndex && endIndex <= nodeEnd) {
				const relativeOffset = endIndex - nodeStart;
				if (relativeOffset < node.length) {
					node.splitText(relativeOffset);
				}

				const citationSpan = document.createElement('span');
				citationSpan.className = INLINE_CITATION_CLASS;
				citationSpan.textContent = `[${citationNumber}]`;
				citationSpan.contentEditable = 'false';

				node.parentNode?.insertBefore(citationSpan, node.nextSibling);

				// Don't re-apply highlights - they'll be updated when claims change
				return true;
			}
			currentOffset += node.length;
		}
		return false;
	}

	function removeHighlights() {
		const highlights = editorElement.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
		highlights.forEach((el) => {
			const parent = el.parentNode;
			if (parent) {
				const textNode = document.createTextNode(el.textContent || '');
				parent.replaceChild(textNode, el);
				parent.normalize();
			}
		});
	}

	function applyHighlights() {
		if (!claims || claims.length === 0) {
			removeHighlights();
			return;
		}

		removeHighlights();
		const text = getTextContent();
		const sortedClaims = [...claims].sort((a, b) => b.startIndex - a.startIndex);

		for (const claim of sortedClaims) {
			const { startIndex, endIndex } = claim;
			if (startIndex < 0 || endIndex > text.length || startIndex >= endIndex) continue;

			const walker = document.createTreeWalker(editorElement, NodeFilter.SHOW_TEXT, {
				acceptNode: (node) => {
					const parent = node.parentElement;
					if (parent?.classList.contains(GHOST_CLASS) || parent?.classList.contains(INLINE_CITATION_CLASS)) {
						return NodeFilter.FILTER_REJECT;
					}
					return NodeFilter.FILTER_ACCEPT;
				}
			});

			let currentOffset = 0;
			let node: Text | null;

			while ((node = walker.nextNode() as Text | null)) {
				const nodeStart = currentOffset;
				const nodeEnd = currentOffset + node.length;

				if (nodeStart <= startIndex && startIndex < nodeEnd) {
					const relativeStart = startIndex - nodeStart;
					const highlightLength = Math.min(endIndex - startIndex, node.length - relativeStart);
					const claimIndex = claims.indexOf(claim);

					const highlightSpan = document.createElement('span');
					highlightSpan.className = HIGHLIGHT_CLASS;
					highlightSpan.dataset.claimIndex = String(claimIndex);
					highlightSpan.addEventListener('click', () => onClaimClick?.(claim, claimIndex));

					if (relativeStart > 0) {
						node.splitText(relativeStart);
						node = node.nextSibling as Text;
					}
					if (highlightLength < node.length) {
						node.splitText(highlightLength);
					}

					node.parentNode?.insertBefore(highlightSpan, node);
					highlightSpan.appendChild(node);
					break;
				}
				currentOffset += node.length;
			}
		}
		editorElement.focus();
	}

	$effect(() => {
		if (editorElement) {
			applyHighlights();
		}
	});

	function removeGhostText() {
		editorElement.querySelectorAll(`.${GHOST_CLASS}`).forEach((el) => el.remove());
		pendingSuggestion = '';
	}

	function insertGhostText(text: string) {
		removeGhostText();
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return;

		const range = selection.getRangeAt(0);
		if (!range.collapsed) return;

		const ghostSpan = document.createElement('span');
		ghostSpan.className = GHOST_CLASS;
		ghostSpan.textContent = text;
		ghostSpan.contentEditable = 'false';

		range.insertNode(ghostSpan);
		range.setStartBefore(ghostSpan);
		range.setEndBefore(ghostSpan);
		selection.removeAllRanges();
		selection.addRange(range);
		pendingSuggestion = text;
	}

	function acceptSuggestion() {
		const ghostElement = editorElement.querySelector(`.${GHOST_CLASS}`);
		if (!ghostElement || !pendingSuggestion) return;

		const textNode = document.createTextNode(pendingSuggestion);
		ghostElement.replaceWith(textNode);

		const selection = window.getSelection();
		if (selection) {
			const range = document.createRange();
			range.setStartAfter(textNode);
			range.setEndAfter(textNode);
			selection.removeAllRanges();
			selection.addRange(range);
		}
		pendingSuggestion = '';
		handleInput();
	}

	function getPrefixAndSuffix(): { prefix: string; suffix: string } {
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) {
			const text = getTextContent();
			return { prefix: text, suffix: '' };
		}

		const range = selection.getRangeAt(0);
		if (!range.collapsed) {
			const text = getTextContent();
			return { prefix: text, suffix: '' };
		}

		// Create a range from start of editor to cursor
		const preRange = document.createRange();
		preRange.selectNodeContents(editorElement);
		preRange.setEnd(range.startContainer, range.startOffset);

		// Create a range from cursor to end of editor
		const postRange = document.createRange();
		postRange.selectNodeContents(editorElement);
		postRange.setStart(range.startContainer, range.startOffset);

		// Get text content, excluding ghost text
		const getCleanText = (r: Range): string => {
			const fragment = r.cloneContents();
			const temp = document.createElement('div');
			temp.appendChild(fragment);
			temp.querySelectorAll(`.${GHOST_CLASS}`).forEach((el) => el.remove());
			temp.querySelectorAll(`.${INLINE_CITATION_CLASS}`).forEach((el) => el.remove());
			return temp.innerText || '';
		};

		return {
			prefix: getCleanText(preRange),
			suffix: getCleanText(postRange)
		};
	}

	function handleInput() {
		removeGhostText();
		isLoading = true;
		const { prefix, suffix } = getPrefixAndSuffix();
		onTextChange?.();

		if (prefix.length < 2) {
			isLoading = false;
			return;
		}

		fetcher.fetch(prefix, suffix, (completion) => {
			if (completion) insertGhostText(completion);
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
			if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') {
				removeGhostText();
			}
		}
	}

	function handleBeforeInput() {
		if (pendingSuggestion) removeGhostText();
	}

	function handleMouseDown() {
		if (pendingSuggestion) {
			removeGhostText();
			fetcher.cancel();
			isLoading = false;
		}
	}

	onMount(() => {
		editorElement.focus();
		return () => fetcher.cancel();
	});

	function handleFormat(command: string, value?: string) {
		editorElement.focus();
		if (command === 'insertBlockquote') {
			document.execCommand('formatBlock', false, 'blockquote');
		} else if (command === 'formatBlock') {
			document.execCommand('formatBlock', false, `<${value}>`);
		} else {
			document.execCommand(command, false, value);
		}
		onTextChange?.();
	}

	function handleFontChange(font: string) {
		currentFont = font;
	}

	function handleBibStyleChange(style: string) {
		onBibStyleChange?.(style as BibliographyStyle);
	}

	async function handleExportPdf() {
		if (isExporting) return;
		isExporting = true;

		try {
			const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
				import('jspdf'),
				import('html2canvas')
			]);

			// Create container for PDF content
			const pdfContainer = document.createElement('div');
			pdfContainer.style.cssText = `
				width: ${PAGE_WIDTH}px;
				padding: ${PAGE_PADDING}px;
				background: #ffffff;
				position: absolute;
				left: -9999px;
				font-family: ${currentFont}, serif;
				font-size: 12pt;
				line-height: 1.6;
				color: #000000;
			`;

			// Clone editor content
			const editorClone = editorElement.cloneNode(true) as HTMLElement;
			editorClone.querySelectorAll(`.${GHOST_CLASS}`).forEach((el) => el.remove());
			editorClone.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
				const text = document.createTextNode(el.textContent || '');
				el.parentNode?.replaceChild(text, el);
			});
			// Apply font to all cloned elements
			editorClone.style.cssText = `font-family: ${currentFont}, serif;`;
			editorClone.querySelectorAll('*').forEach((el) => {
				if (el instanceof HTMLElement) {
					el.style.fontFamily = `${currentFont}, serif`;
				}
			});
			pdfContainer.appendChild(editorClone);

			// Add bibliography if entries exist
			if (bibliography.length > 0) {
				const bibSection = document.createElement('div');
				bibSection.style.cssText = `margin-top: 48px; padding-top: 24px; border-top: 1px solid #ccc; font-family: ${currentFont}, serif;`;

				const bibTitle = document.createElement('h2');
				bibTitle.textContent = 'References';
				bibTitle.style.cssText = `font-size: 18pt; margin-bottom: 16px; font-weight: bold; font-family: ${currentFont}, serif;`;
				bibSection.appendChild(bibTitle);

				const bibContent = document.createElement('div');
				bibContent.style.cssText = `font-size: 11pt; line-height: 1.8; font-family: ${currentFont}, serif;`;
				// Use current bibStyle value
				const currentBibStyle = bibStyle;
				bibContent.innerHTML = formatBibliography(bibliography, currentBibStyle).html;
				bibSection.appendChild(bibContent);

				pdfContainer.appendChild(bibSection);
			}

			document.body.appendChild(pdfContainer);

			const canvas = await html2canvas(pdfContainer, {
				scale: 2,
				useCORS: true,
				logging: false,
				backgroundColor: '#ffffff'
			});

			document.body.removeChild(pdfContainer);

			const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
			const pageWidth = pdf.internal.pageSize.getWidth();
			const pageHeight = pdf.internal.pageSize.getHeight();

			const imgWidth = pageWidth;
			const imgHeight = (canvas.height * imgWidth) / canvas.width;

			let heightLeft = imgHeight;
			let position = 0;

			pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
			heightLeft -= pageHeight;

			while (heightLeft > 0) {
				position = heightLeft - imgHeight;
				pdf.addPage();
				pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
				heightLeft -= pageHeight;
			}

			const filename = documentTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'document';
			pdf.save(`${filename}.pdf`);
		} catch (error) {
			console.error('PDF export failed:', error);
			alert('Failed to export PDF. Please try again.');
		} finally {
			isExporting = false;
		}
	}
</script>

<div class="editor-wrapper">
	<EditorToolbar
		onFormat={handleFormat}
		onExportPdf={handleExportPdf}
		onFontChange={handleFontChange}
		onBibStyleChange={handleBibStyleChange}
		{isExporting}
		{currentFont}
		currentBibStyle={bibStyle}
	/>

	<div class="pages-container">
		<div class="page" style="--editor-font: {currentFont}">
			<div
				class="editor"
				bind:this={editorElement}
				contenteditable="true"
				oninput={handleInput}
				onkeydown={handleKeyDown}
				onbeforeinput={handleBeforeInput}
				onmousedown={handleMouseDown}
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
	</div>
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
	.editor-wrapper {
		width: 100%;
		max-width: 900px;
		margin: 0 auto;
	}

	.pages-container {
		background: #e5e7eb;
		padding: 2rem;
		border-radius: 0.5rem;
		min-height: 80vh;
	}

	.page {
		position: relative;
		width: 8.5in;
		min-height: 11in;
		margin: 0 auto;
		background: #ffffff;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		padding: 1in;
		box-sizing: border-box;
		font-family: var(--editor-font), serif;
	}

	.editor {
		width: 100%;
		min-height: calc(11in - 2in);
		font-family: var(--editor-font), serif;
		font-size: 12pt;
		line-height: 1.6;
		color: #000000;
		background: transparent;
		border: none;
		outline: none;
		word-wrap: break-word;
	}

	/* Ensure all elements inherit the font */
	.editor :global(*) {
		font-family: inherit;
	}

	.editor:empty::before {
		content: 'Start writing your essay...';
		color: #9ca3af;
		pointer-events: none;
	}

	/* Heading styles */
	.editor :global(h1) {
		font-size: 24pt;
		font-weight: bold;
		line-height: 1.3;
		margin: 18pt 0 12pt 0;
		color: #000000;
	}

	.editor :global(h2) {
		font-size: 18pt;
		font-weight: bold;
		line-height: 1.4;
		margin: 14pt 0 8pt 0;
		color: #000000;
	}

	.editor :global(h3) {
		font-size: 14pt;
		font-weight: bold;
		line-height: 1.5;
		margin: 12pt 0 6pt 0;
		color: #000000;
	}

	.editor :global(p) {
		margin: 0 0 12pt 0;
	}

	.editor :global(ul),
	.editor :global(ol) {
		margin: 6pt 0 12pt 24pt;
		padding: 0;
	}

	.editor :global(li) {
		margin: 3pt 0;
	}

	.editor :global(blockquote) {
		margin: 12pt 0 12pt 24pt;
		padding: 0 0 0 12pt;
		border-left: 3pt solid #6366f1;
		font-style: italic;
		color: #4b5563;
	}

	.editor :global(hr) {
		border: none;
		border-top: 1pt solid #d1d5db;
		margin: 24pt 0;
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
		font-size: 0.75em;
		font-weight: 600;
		vertical-align: super;
		font-family: ui-monospace, monospace;
		cursor: default;
		user-select: none;
	}

	.loading-indicator {
		position: absolute;
		bottom: 1in;
		right: 1in;
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
		0%, 100% { opacity: 0.3; transform: scale(0.8); }
		50% { opacity: 1; transform: scale(1); }
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
