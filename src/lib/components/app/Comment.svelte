<script lang="ts">
	import { Check } from '$lib/model/app/checks';
	import { Form } from '$lib/utils/form';
	import { capitalize, fromCamelCase } from 'ts-utils/text';
	interface Props {
		check: Check;
		color: 'success' | 'primary' | 'warning' | 'danger';
	}

	const { check, color }: Props = $props();
</script>

{#if $check.value && $check.doComment}
	<div class="row mb-3">
		<div class="col">
			<div class="card border-{color}">
				<label for="comment-{$check.name}" class="form-label px-3 pt-3">
					{#if $check.render}
						Please elaborate on the check:
					{/if}
					{capitalize(fromCamelCase($check.name))}
				</label>
				<textarea
					class="form-control"
					id="comment-{$check.name}"
					rows="3"
					bind:value={$check.comment}
					placeholder="Write {capitalize(fromCamelCase($check.name))} comment here..."
					oninput={(e) => {
						check.update((c) => ({ ...c, comment: e.currentTarget.value }));
					}}
				></textarea>
				{#if $check.builder.length > 0}
					<button
						type="button"
						class="btn btn-{color}"
						onclick={async () => {
							let f = await new Form()
								.input('builder', {
									type: 'checkbox',
									options: $check.builder,
									required: false,
									label: 'Builder'
									// value: $check.comment.split('\n'),
								})
								.prompt({
									send: false,
									title: `${capitalize(fromCamelCase($check.name))} Comment Builder`
								});
							if (f.isOk()) {
								// $check.comment = f.value.value.builder.join('\n');
								check.update((c) => ({
									...c,
									comment: f.value.value.builder.join('\n')
								}));
							} else {
								console.error(f.error);
							}
						}}
					>
						<i class="material-icons"> edit </i>
						{capitalize(fromCamelCase($check.name))} Comment Builder
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
