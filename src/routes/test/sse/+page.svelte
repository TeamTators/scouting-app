<script lang="ts">
	import { sse } from '$lib/utils/sse';

	sse.on('message', console.log);
</script>
