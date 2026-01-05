<script lang="ts">
	import type { Comment } from '$lib/model/app/comments';
	import { onMount } from 'svelte';
	import { capitalize, fromCamelCase } from 'ts-utils';
	// import { onMount } from 'svelte';

	interface Props {
		comment: Comment;
	}

	const { comment }: Props = $props();

	let chars = $state(0);

	onMount(() => {
		return comment.subscribe((comment) => {
			chars = comment.value.length;
		});
	});
</script>

{#if $comment.show}
	<div class="row mb-3">
		<div class="col">
			<div class="card" style="border-color: var(--bs-{$comment.color})">
				<div class="card-body">
					<label for="comment-{$comment.key}" class="form-label"
						>{capitalize(fromCamelCase(comment.key))}:
						<span
							class:text-muted={chars < 50}
							class:text-warning={chars < 75}
							class:text-danger={chars >= 75}>{chars}/100</span
						></label
					>
					<textarea
						id="comment-{$comment.key}"
						class="form-control"
						bind:value={comment.value}
						rows="3"
						maxlength="100"
						placeholder="Please provide a brief description... (max 100 characters)"
					></textarea>
				</div>
			</div>
		</div>
	</div>
{/if}
