<script lang="ts">
	import type { Check } from "$lib/model/app/new/checks";
	import { capitalize, fromCamelCase } from "ts-utils/text";

    interface Props {
        check: Check;
        color: 'success' | 'primary' | 'warning' | 'danger';
    }

    const { check, color }: Props = $props();
</script>

<div 
style="
    aspect-ratio: 1 / 1;
    width: 86px !important;
"
>
    <input type="checkbox" name="{$check.name}" class="btn-check" id="check-{color}-{$check.name}" onchange={(e) => {
        check.set({
            ...check.data,
            value: e.currentTarget.checked,
        });
    }}>
    <label for="check-{color}-{$check.name}" class="btn bg-lg btn-outline-{color} text-align-middle w-100 h-100 p-0">{capitalize(fromCamelCase($check.name))}</label>
</div>