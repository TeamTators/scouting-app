<script lang="ts">
    import { scanQR } from "$lib/utils/qr";

    let result: string | null = null;
</script>

<div class="container">
    <div class="row mb-3">
        <button type="button" class="btn btn-primary" onclick={() => scanQR().then(res => result = res.unwrap())}>
            Scan QR Code
        </button>
    </div>
    {#if result}
        <div class="row">
            <div class="col">
                <h5>Result:</h5>
                <p>{result}</p>
            </div>
        </div>
    {/if}
</div>
