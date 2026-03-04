<script lang="ts">
	import { App } from '$lib/model/app/app';

	interface Props {
		app: App;
	}

	const { app }: Props = $props();
	const reviewFlag = $derived(app.reviewFlag);
</script>

<div class="flex flex-col gap-4">
	<input
		type="checkbox"
		name="flag-for-review"
		id="flag-for-review"
		onchange={(e) =>
			app.reviewFlag.update((data) => ({ ...data, flagged: e.currentTarget.checked }))}
		class="btn-check w-100"
		bind:checked={$reviewFlag.flagged}
	/>
	<label class="btn btn-outline-warning w-100" for="flag-for-review">
		<i class="material-icons"> flag </i>
		Flag for Review
	</label>
	<div class="flex flex-col gap-2">
		<small class="text-small text-muted">
			If you don't feel confident in the accuracy of your data, you can flag this match for review.
			By doing so, you indicate to us that someone should take a closer look at the data.
		</small>
		<div class="flex items-center gap-2">
			<textarea
				placeholder="Reason for review (optional)"
				bind:value={$reviewFlag.reason}
				class="form-control"
				disabled={!$reviewFlag.flagged}
				onchange={(e) =>
					app.reviewFlag.update((data) => ({ ...data, reason: e.currentTarget.value }))}
			></textarea>
		</div>
	</div>
</div>
