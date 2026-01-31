<script lang="ts">
	import Editor from '$lib/components/Editor.svelte';
</script>

<svelte:head>
	<title>TabWrite - AI-Powered Essay Writing</title>
	<meta name="description" content="Write essays with AI-powered tab-autocomplete suggestions" />
</svelte:head>

<main>
	<header>
		<h1>TabWrite</h1>
	</header>
	<Editor />
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
</style>
