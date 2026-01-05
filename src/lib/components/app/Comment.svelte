<script lang="ts">
	import type { Comment } from '$lib/model/app/comments';
	import { capitalize, fromCamelCase } from 'ts-utils';
	// import { onMount } from 'svelte';

	interface Props {
		comment: Comment;
	}

	const { comment }: Props = $props();
</script>

{#key $comment}
	<div class="row mb-3">
		<div class="col">
			<div class="card" style="border-color: var(--bs-{comment.color})">
				<div class="card-body">
					<label for="comment-{comment.key}" class="form-label"
						>{capitalize(fromCamelCase(comment.key))}:</label
					>
					<textarea id="comment-{comment.key}" class="form-control" bind:value={$comment[1]}
					></textarea>
				</div>
			</div>
		</div>
	</div>
{/key}
