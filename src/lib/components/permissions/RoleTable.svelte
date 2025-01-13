<script lang="ts">
	import { Permissions } from '../../model/permissions';
	// import RoleEditor from './RoleEditor.svelte';
	// import Modal from '../bootstrap/Modal.svelte';
	import { prompt } from '$lib/utils/prompts';
	import type { Universes } from '$lib/model/universe';

	interface Props {
		universe: Universes.UniverseData;
	}

	const { universe }: Props = $props();

	const roles = Permissions.Role.fromProperty('universe', universe.data.id, false);

	let selected: Permissions.RoleData | null = $state(null);

	const createNew = async () => {
		if (!universe.data.id) return;
		const name = await prompt('Role Name');
		if (!name) return;
		const description = await prompt('Role Description');
		if (!description) return;

		const res = await Permissions.Role.new({
			name,
			description,
			universe: universe.data.id,
			permissions: '',
			linkAccess: ''
		});

		if (res.isErr()) {
			console.error('Failed to create role', res.error);
		}
	};

	// let editor: RoleEditor;
	// let modal: Modal;
</script>

<button class="btn btn-primary w-100" type="button" onclick={createNew}>
	Create New Role
	<i class="material-icons">add</i>
</button>

<table class="table table-hover">
	<thead>
		<tr>
			<th>Role</th>
			<th>Description</th>
		</tr>
	</thead>
	<tbody>
		{#each $roles as role}
			<tr
				class="cursor-pointer"
				onclick={() => {
					selected = role;
				}}
			>
				<td>{role.data.name}</td>
				<td>{role.data.description}</td>
			</tr>
		{/each}
	</tbody>
</table>
<!-- 
{#if selected}
    <Modal
        bind:this="{modal}"
        title="{'Role: ' + selected.data.name}"
        bind:show="{showEditor}"
        on:hide="{() => (selected = null)}"
        on:close="{() => (selected = null)}"
    >
        <RoleEditor
            bind:this="{editor}"
            role="{selected}" />
        <div slot="buttons">
            <button
                class="btn btn-primary"
                type="button"
                onclick="{() => editor.save()}"
            >
                Save
            </button>
            <button
                class="btn btn-warning"
                type="button"
                onclick="{() => editor.reset()}"
            >
                Reset
            </button>
            <button
                class="btn btn-secondary"
                type="button"
                onclick="{() => modal.close()}"
            >
                Close
            </button>
        </div>
    </Modal>
{/if} -->
