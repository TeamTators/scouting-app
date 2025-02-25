<script lang="ts">
	import { App } from "$lib/model/app/new/app";
	import { Form } from "$lib/utils/form";
	import { onMount } from "svelte";
	import { capitalize, fromCamelCase } from "ts-utils/text";
    import { writable, type Writable } from 'svelte/store';
	import { Check } from "$lib/model/app/new/checks";
    import CheckRow from '$lib/components/app/Check.svelte';
    import Comment from '$lib/components/app/Comment.svelte';

    interface Props {
        app: App;
    };

    const { app }: Props = $props();

    const checks = app.checks;

    const success = checks.getType('success');
    const primary = checks.getType('primary');
    const warning = checks.getType('warning');
    const danger = checks.getType('danger');

</script>



{#snippet checksRow(checks: Check[], color: 'success' | 'primary' | 'warning' | 'danger')}
    <div class="row mb-3">
        <div style="
            display: grid;
            grid-template-columns: repeat(var(--grid-size), 1fr);
            gap: 8px;
        ">
            {#each checks as check}
                <CheckRow {check} {color} />
            {/each}
        </div>
    </div>
{/snippet}

<div class="container" style="padding-top: {38 + 16}px;">
    {@render checksRow($success, 'success')}
    {@render checksRow($primary, 'primary')}
    {@render checksRow($warning, 'warning')}
    {@render checksRow($danger, 'danger')}
    {#each $success as check}
        <Comment {check} color='success' />
    {/each}
    {#each $primary as check}
        <Comment {check} color='primary' />
    {/each}
    {#each $warning as check}
        <Comment {check} color='warning' />
    {/each}
    {#each $danger as check}
        <Comment {check} color='danger' />
    {/each}
</div>

<style>
	:root {
		--grid-size: 5; /* Default for extra-large screens */
	}

	@media (max-width: 1200px) {
		:root {
			--grid-size: 10; /* Large screens */
		}
	}

	@media (max-width: 992px) {
		:root {
			--grid-size: 8; /* Medium screens */
		}
	}

	@media (max-width: 768px) {
		:root {
			--grid-size: 6; /* Small screens */
		}
	}

	@media (max-width: 576px) {
		:root {
			--grid-size: 4 !important; /* Extra small screens */
		}
	}
</style>