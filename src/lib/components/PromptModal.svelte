<script lang="ts">
	import type { ActionType } from '../../routes/api/prompt/+server';

	interface Props {
		isOpen: boolean;
		selectedText: string;
		isProcessing: boolean;
		onClose: () => void;
		onSubmit: (instruction: string, actionType: ActionType) => void;
	}

	let { isOpen, selectedText, isProcessing, onClose, onSubmit }: Props = $props();

	let customInstruction = $state('');

	const quickActions: { label: string; type: ActionType; instruction: string }[] = [
		{ label: 'Rewrite', type: 'rewrite', instruction: 'Rewrite this text to be clearer and more concise' },
		{ label: 'Analyze', type: 'analyze', instruction: 'Analyze this text and provide feedback' },
		{ label: 'Expand', type: 'expand', instruction: 'Expand this text with more detail' },
		{ label: 'Summarize', type: 'summarize', instruction: 'Summarize this text briefly' }
	];

	function handleQuickAction(action: typeof quickActions[0]) {
		onSubmit(action.instruction, action.type);
	}

	function handleCustomSubmit() {
		if (customInstruction.trim()) {
			onSubmit(customInstruction.trim(), 'custom');
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape' && !isProcessing) {
			onClose();
		} else if (event.key === 'Enter' && !event.shiftKey && customInstruction.trim()) {
			event.preventDefault();
			handleCustomSubmit();
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget && !isProcessing) {
			onClose();
		}
	}

	$effect(() => {
		if (isOpen) {
			customInstruction = '';
		}
	});
</script>

{#if isOpen}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div
		class="modal-backdrop"
		onclick={handleBackdropClick}
		onkeydown={handleKeyDown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
	>
		<div class="modal-content">
			<div class="modal-header">
				<h2 id="modal-title">Prompt AI</h2>
				<button class="close-button" onclick={onClose} disabled={isProcessing} aria-label="Close">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6L6 18M6 6l12 12"/>
					</svg>
				</button>
			</div>

			<div class="selected-text-preview">
				<span class="preview-label">Selected text:</span>
				<p class="preview-text">{selectedText.length > 200 ? selectedText.slice(0, 200) + '...' : selectedText}</p>
			</div>

			<div class="quick-actions">
				<span class="section-label">Quick actions:</span>
				<div class="action-buttons">
					{#each quickActions as action}
						<button
							class="action-button"
							onclick={() => handleQuickAction(action)}
							disabled={isProcessing}
						>
							{action.label}
						</button>
					{/each}
				</div>
			</div>

			<div class="custom-input-section">
				<label for="custom-instruction" class="section-label">Or enter custom instruction:</label>
				<textarea
					id="custom-instruction"
					bind:value={customInstruction}
					placeholder="e.g., Make this more formal, Fix grammar errors, Translate to Spanish..."
					disabled={isProcessing}
					rows="3"
				></textarea>
				<button
					class="submit-button"
					onclick={handleCustomSubmit}
					disabled={isProcessing || !customInstruction.trim()}
				>
					{#if isProcessing}
						<span class="spinner"></span>
						Processing...
					{:else}
						Submit
					{/if}
				</button>
			</div>

			{#if isProcessing}
				<div class="processing-overlay">
					<div class="processing-indicator">
						<span class="spinner large"></span>
						<span>Processing your request...</span>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2000;
		animation: fadeIn 0.15s ease-out;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.modal-content {
		position: relative;
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
		width: 90%;
		max-width: 500px;
		max-height: 90vh;
		overflow-y: auto;
		animation: slideIn 0.2s ease-out;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(-20px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: #111827;
	}

	.close-button {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.375rem;
		background: none;
		border: none;
		border-radius: 0.375rem;
		color: #6b7280;
		cursor: pointer;
		transition: background-color 0.15s, color 0.15s;
	}

	.close-button:hover:not(:disabled) {
		background: #f3f4f6;
		color: #111827;
	}

	.close-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.selected-text-preview {
		padding: 1rem 1.25rem;
		background: #f9fafb;
		border-bottom: 1px solid #e5e7eb;
	}

	.preview-label,
	.section-label {
		display: block;
		font-size: 0.75rem;
		font-weight: 500;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.025em;
		margin-bottom: 0.5rem;
	}

	.preview-text {
		margin: 0;
		font-size: 0.875rem;
		color: #374151;
		line-height: 1.5;
		font-style: italic;
	}

	.quick-actions {
		padding: 1rem 1.25rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.action-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.action-button {
		padding: 0.5rem 1rem;
		background: #f3f4f6;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
		cursor: pointer;
		transition: all 0.15s;
	}

	.action-button:hover:not(:disabled) {
		background: #e5e7eb;
		border-color: #d1d5db;
	}

	.action-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.custom-input-section {
		padding: 1rem 1.25rem 1.25rem;
	}

	textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-family: inherit;
		resize: vertical;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	textarea:focus {
		outline: none;
		border-color: #4f46e5;
		box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
	}

	textarea:disabled {
		background: #f9fafb;
		cursor: not-allowed;
	}

	.submit-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		margin-top: 0.75rem;
		padding: 0.75rem 1rem;
		background: #4f46e5;
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.submit-button:hover:not(:disabled) {
		background: #4338ca;
	}

	.submit-button:disabled {
		background: #9ca3af;
		cursor: not-allowed;
	}

	.spinner {
		display: inline-block;
		width: 1rem;
		height: 1rem;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: spin 0.75s linear infinite;
	}

	.spinner.large {
		width: 1.5rem;
		height: 1.5rem;
		border-width: 2px;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.processing-overlay {
		position: absolute;
		inset: 0;
		background: rgba(255, 255, 255, 0.9);
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.75rem;
	}

	.processing-indicator {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		color: #4f46e5;
		font-weight: 500;
	}
</style>
