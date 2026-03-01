<script lang="ts">
	import { SupaStruct } from "$lib/services/supabase/supastruct";

    const struct = new SupaStruct('test', {
        debug: true,
    });
    const data = struct.all();

</script>

<div class="container layer-1">
<div class="row mb-3">

    {#each $data as item (item.data.id)}
        <div class="col-md-4">
            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title">{item.data.id}</h5>
                    <p class="card-text">{item.data.name}</p>
                    <button type="button" class="btn btn-danger" onclick={() => item.delete()}>
                        <i class="material-icons">
                            delete
                        </i>
                    </button>
                </div>
            </div> 
        </div>
    {/each}
</div>
</div>