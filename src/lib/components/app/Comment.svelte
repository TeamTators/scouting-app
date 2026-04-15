<script lang="ts">
	import type { Comment } from '$lib/model/app/comments';
	import { onMount } from 'svelte';
	import { capitalize, fromCamelCase } from 'ts-utils';

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
							class:text-muted={chars < 150}
							class:text-warning={chars < 175}
							class:text-danger={chars >= 175}>{chars}/200</span
						></label
					>
					<textarea
						id="comment-{$comment.key}"
						class="form-control"
						bind:value={comment.value}
						rows="3"
						maxlength="200"
						placeholder="{$comment.placeholder} (Max 200 characters)"
					></textarea>
				</div>
			</div>
		</div>
	</div>
{/if}
