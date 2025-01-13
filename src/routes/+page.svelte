<script lang="ts">
	import Card from '$lib/components/bootstrap/Card.svelte';
</script>

<div class="container mt-5">
	<div class="row">
		<div class="col">
			<Card title="Page">
				{#snippet body()}
					<h1>Page</h1>
					<p>This is a page.</p>
				{/snippet}
			</Card>
		</div>
	</div>
</div>
