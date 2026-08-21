<script lang="ts">
	import Grid from '$lib/components/general/Grid.svelte';
	import { onMount } from 'svelte';
	import { contextmenu } from '$lib/utils/contextmenu.js';
import { TextEditorModule, NumberEditorModule } from 'ag-grid-community';

	const { data } = $props();

	const Test = $derived(data.Test);
	const all = $derived(data.query.reactive);

	onMount(() => {
		const unsubscribe = data.query.subscribe();
		return () => unsubscribe();
	});
</script>

<button
	class="btn btn-primary"
	type="button"
	onclick={async () => {
		Test.new({
			name: `Test ${Math.random()}`,
			age: Math.round(Math.random() * 100)
		});
	}}
>
	New ({all.length} + 1)
</button>
<Grid
	data={all}
	opts={{
		columnDefs: [
			{
				field: 'raw.name',
				headerName: 'Name',
				editable: true,
				onCellValueChanged: (params) => {
					if (!params.data) return;
					params.data.update({
						name: params.newValue,
					});
				}
			},
			{
				field: 'raw.age',
				headerName: 'Age',
				editable: true,
				onCellValueChanged: (params) => {
					if (!params.data) return;
					console.log('Updated age to', params.newValue);
					params.data.update({
						age: params.newValue,
					});
				}
			}
		],
		preventDefaultOnContextMenu: true,
		onCellContextMenu: (params) => {
			if (!params.data) return;

			contextmenu(params.event as PointerEvent, {
				options: [
					{
						name: 'Delete',
						action: () => params.data?.delete(),
						icon: {
							type: 'material-icons',
							name: 'delete',
						}
					}
				]
			});
		},
	}}
	height="400px"
	modules={[TextEditorModule, NumberEditorModule]}
	debug={true}
	redraw_on_update={true}
/>
