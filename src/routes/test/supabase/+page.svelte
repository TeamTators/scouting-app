<script lang="ts">
	import supabase from '$lib/services/supabase';
	import { SupaStruct } from '$lib/services/supabase/supastruct';

	const struct = new SupaStruct({
		name: 'test',
		client: supabase,
		debug: true
	});
	const data = struct.all({
		type: 'all',
	});
</script>

<div class="container layer-1">
<div class="row mb-3">
	<div class="d-flex">
		<h1>
			SupaStruct Test
		</h1>
		<button class="btn btn-primary ms-3" onclick={() => struct.new({ name: 'New Item', age: Math.floor(Math.random() * 100) })}>
			<i class="material-icons"> add </i>
		</button>
	</div>
</div>
	<div class="row mb-3">
		{#each $data as item (item.data.id)}
			<div class="col-md-4">
				<div class="card mb-3">
					<div class="card-body">
						<h5 class="card-title">{item.data.id}</h5>
						<p class="card-text">{item.data.name}</p>
						<button type="button" class="btn btn-danger" onclick={() => item.delete()}>
							<i class="material-icons"> delete </i>
						</button>
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>
