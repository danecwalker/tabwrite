<script lang="ts">
	interface Props {
		onFormat: (command: string, value?: string) => void;
		onExportPdf: () => void;
		onFontChange: (font: string) => void;
		onBibStyleChange: (style: string) => void;
		isExporting?: boolean;
		currentFont?: string;
		currentBibStyle?: string;
	}

	let {
		onFormat,
		onExportPdf,
		onFontChange,
		onBibStyleChange,
		isExporting = false,
		currentFont = 'Georgia',
		currentBibStyle = 'apa'
	}: Props = $props();

	const fonts = [
		{ value: 'Georgia', label: 'Georgia' },
		{ value: 'Times New Roman', label: 'Times New Roman' },
		{ value: 'Arial', label: 'Arial' },
		{ value: 'Helvetica', label: 'Helvetica' },
		{ value: 'Garamond', label: 'Garamond' },
		{ value: 'Cambria', label: 'Cambria' },
	];

	const bibStyles = [
		{ value: 'apa', label: 'APA' },
		{ value: 'mla', label: 'MLA' },
		{ value: 'chicago', label: 'Chicago' },
		{ value: 'ieee', label: 'IEEE' },
		{ value: 'harvard', label: 'Harvard' },
	];

	function handleFormat(command: string, value?: string) {
		onFormat(command, value);
	}
</script>

<div class="toolbar">
	<div class="toolbar-row">
		<div class="toolbar-group">
			<select
				class="toolbar-select font-select"
				value={currentFont}
				onchange={(e) => onFontChange(e.currentTarget.value)}
				title="Font"
			>
				{#each fonts as font}
					<option value={font.value}>{font.label}</option>
				{/each}
			</select>
		</div>

		<div class="toolbar-divider"></div>

		<div class="toolbar-group">
			<button
				class="toolbar-btn"
				onclick={() => handleFormat('formatBlock', 'h1')}
				title="Heading 1"
			>
				H1
			</button>
			<button
				class="toolbar-btn"
				onclick={() => handleFormat('formatBlock', 'h2')}
				title="Heading 2"
			>
				H2
			</button>
			<button
				class="toolbar-btn"
				onclick={() => handleFormat('formatBlock', 'h3')}
				title="Heading 3"
			>
				H3
			</button>
			<button
				class="toolbar-btn"
				onclick={() => handleFormat('formatBlock', 'p')}
				title="Paragraph"
			>
				P
			</button>
		</div>

		<div class="toolbar-divider"></div>

		<div class="toolbar-group">
			<button
				class="toolbar-btn"
				onclick={() => handleFormat('bold')}
				title="Bold (Ctrl+B)"
			>
				<strong>B</strong>
			</button>
			<button
				class="toolbar-btn"
				onclick={() => handleFormat('italic')}
				title="Italic (Ctrl+I)"
			>
				<em>I</em>
			</button>
			<button
				class="toolbar-btn"
				onclick={() => handleFormat('underline')}
				title="Underline (Ctrl+U)"
			>
				<span style="text-decoration: underline;">U</span>
			</button>
		</div>

		<div class="toolbar-divider"></div>

		<div class="toolbar-group">
			<button
				class="toolbar-btn"
				onclick={() => handleFormat('insertUnorderedList')}
				title="Bullet List"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="8" y1="6" x2="21" y2="6"></line>
					<line x1="8" y1="12" x2="21" y2="12"></line>
					<line x1="8" y1="18" x2="21" y2="18"></line>
					<circle cx="3" cy="6" r="1" fill="currentColor"></circle>
					<circle cx="3" cy="12" r="1" fill="currentColor"></circle>
					<circle cx="3" cy="18" r="1" fill="currentColor"></circle>
				</svg>
			</button>
			<button
				class="toolbar-btn"
				onclick={() => handleFormat('insertOrderedList')}
				title="Numbered List"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="10" y1="6" x2="21" y2="6"></line>
					<line x1="10" y1="12" x2="21" y2="12"></line>
					<line x1="10" y1="18" x2="21" y2="18"></line>
					<text x="3" y="7" font-size="8" fill="currentColor" stroke="none">1</text>
					<text x="3" y="13" font-size="8" fill="currentColor" stroke="none">2</text>
					<text x="3" y="19" font-size="8" fill="currentColor" stroke="none">3</text>
				</svg>
			</button>
			<button
				class="toolbar-btn"
				onclick={() => handleFormat('insertBlockquote')}
				title="Quote"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"></path>
					<path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z"></path>
				</svg>
			</button>
			<button
				class="toolbar-btn"
				onclick={() => handleFormat('insertHorizontalRule')}
				title="Section Divider"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="3" y1="12" x2="21" y2="12"></line>
				</svg>
			</button>
		</div>

		<div class="toolbar-divider"></div>

		<div class="toolbar-group">
			<label class="toolbar-label" for="bib-style-select">Bibliography:</label>
			<select
				id="bib-style-select"
				class="toolbar-select bib-select"
				value={currentBibStyle}
				onchange={(e) => onBibStyleChange(e.currentTarget.value)}
				title="Bibliography Style"
			>
				{#each bibStyles as style}
					<option value={style.value}>{style.label}</option>
				{/each}
			</select>
		</div>

		<div class="toolbar-spacer"></div>

		<div class="toolbar-group">
			<button
				class="toolbar-btn export-btn"
				onclick={onExportPdf}
				disabled={isExporting}
				title="Export as PDF"
			>
				{#if isExporting}
					<span class="spinner"></span>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
						<polyline points="7 10 12 15 17 10"></polyline>
						<line x1="12" y1="15" x2="12" y2="3"></line>
					</svg>
				{/if}
				<span>PDF</span>
			</button>
		</div>
	</div>
</div>

<style>
	.toolbar {
		background: #ffffff;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		margin-bottom: 1rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
	}

	.toolbar-row {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.5rem 0.75rem;
		flex-wrap: wrap;
	}

	.toolbar-group {
		display: flex;
		align-items: center;
		gap: 0.125rem;
	}

	.toolbar-label {
		font-size: 0.75rem;
		color: #6b7280;
		margin-right: 0.25rem;
	}

	.toolbar-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		min-width: 32px;
		height: 32px;
		padding: 0 0.5rem;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 0.375rem;
		color: #374151;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.toolbar-btn:hover:not(:disabled) {
		background: #f3f4f6;
		border-color: #e5e7eb;
	}

	.toolbar-btn:active:not(:disabled) {
		background: #e5e7eb;
	}

	.toolbar-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.toolbar-select {
		height: 32px;
		padding: 0 0.5rem;
		border: 1px solid #e5e7eb;
		border-radius: 0.375rem;
		background: #ffffff;
		font-size: 0.8125rem;
		color: #374151;
		cursor: pointer;
	}

	.toolbar-select:hover {
		border-color: #d1d5db;
	}

	.font-select {
		width: 130px;
	}

	.bib-select {
		width: 90px;
	}

	.toolbar-divider {
		width: 1px;
		height: 24px;
		background: #e5e7eb;
		margin: 0 0.5rem;
	}

	.toolbar-spacer {
		flex: 1;
	}

	.export-btn {
		background: #6366f1;
		color: #ffffff;
		border-color: #6366f1;
		padding: 0 0.75rem;
	}

	.export-btn:hover:not(:disabled) {
		background: #4f46e5;
		border-color: #4f46e5;
	}

	.spinner {
		width: 14px;
		height: 14px;
		border: 2px solid transparent;
		border-top-color: currentColor;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
