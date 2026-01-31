<script lang="ts">
	import Editor from '$lib/components/Editor.svelte';
	import CitationSidebar from '$lib/components/CitationSidebar.svelte';
	import type { CitationClaim } from './api/citations/+server';
	import type { CitationSuggestion } from './api/citations/search/+server';

	interface ClaimWithSuggestions {
		claim: CitationClaim;
		suggestions: CitationSuggestion[];
		isLoading: boolean;
	}

	let claimsWithSuggestions = $state<ClaimWithSuggestions[]>([]);
	let isDetecting = $state(false);
	let activeClaimIndex = $state<number | null>(null);

	// Extract just the claims for the editor
	let claims = $derived(claimsWithSuggestions.map((c) => c.claim));

	function handleClaimClick(claim: CitationClaim, index: number) {
		activeClaimIndex = index;
		// Clear active state after a short delay
		setTimeout(() => {
			activeClaimIndex = null;
		}, 2000);
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
			<Editor {claims} onClaimClick={handleClaimClick} />
		</div>
		<CitationSidebar claims={claimsWithSuggestions} {isDetecting} {activeClaimIndex} />
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
</style>
