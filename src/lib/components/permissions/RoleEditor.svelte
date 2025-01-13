<script lang="ts">
	import { type Blank } from 'drizzle-struct/front-end';
	import { capitalize, fromCamelCase } from 'ts-utils/text';
	import { Permissions } from '$lib/model/permissions';
	import { confirm } from '$lib/utils/prompts';
	import StructTable from './StructTable.svelte';

	interface Props {
		role: Permissions.RoleData;
	}

	const { role }: Props = $props();

	let structs = $state(Permissions.StructPermissions.getAll(role));

	export const save = async () => {
		const confirmed = await confirm('Are you sure you want to save these changes?');
		if (confirmed) {
			Permissions.StructPermissions.save(structs);
		}
	};

	export const reset = () => {
		for (const s of structs) s.reset();
	};
</script>

<div class="container">
	<div class="row">
		<div class="accordion">
			{#each structs as struct, i}
				<div class="accordion-item">
					<div class="accordion-header">
						<button
							type="button"
							class="accordion-button collapsed"
							aria-controls="role-editor-collapse-{i}"
							data-bs-target="#role-editor-collapse-{i}"
							data-bs-toggle="collapse"
						>
							{capitalize(fromCamelCase(struct.struct.data.name))}
						</button>
					</div>
				</div>
				<div
					id="role-editor-collapse-{i}"
					class="accordion-collapse collapse"
					data-bs-parent="role-editor"
				>
					<div class="accordion-body">
						<StructTable {struct} />
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
