<script lang="ts">
	import { type Blank } from 'drizzle-struct/front-end';
	import { capitalize, fromCamelCase } from 'ts-utils/text';
	import { Permissions } from '../../model/permissions';

	interface Props {
		property: Permissions.StructProperty<Blank>;
		structName: string;
	}

	const { property = $bindable(), structName }: Props = $props();

	const name = property.data.property;
	let read = $state(false);
	let update = $state(false);

	$effect(() => {
		read = $property.read;
		update = $property.update;
	});
</script>

<tr>
	<td>{capitalize(fromCamelCase(structName))} - {capitalize(fromCamelCase(String(name)))}</td>
	<td>
		<div class="form-check form-switch">
			<input
				id="role-editor-{structName}-{name}-read"
				class="form-check-input"
				type="checkbox"
				bind:checked={read}
				onchange={() => {
					if (!read) update = false;

					property.set({
						read,
						update,
						property: name
					});
				}}
			/>
		</div>
	</td>
	<td>
		<div class="form-check form-switch">
			<input
				id="role-editor-{structName}-{name}-update"
				class="form-check-input"
				type="checkbox"
				bind:checked={update}
				onchange={() => {
					if (update) read = true;

					property.set({
						read,
						update,
						property: name
					});
				}}
			/>
		</div>
	</td>
</tr>
