<script lang="ts">
    import { onMount } from 'svelte';
    import QR from 'qr-scanner';

    interface Props {
        onScan: (result: string) => void;
    }

    const { onScan }: Props = $props();

    let scanner: QR;
    let video: HTMLVideoElement;

    export const start = () => scanner.start();
    export const stop = () => scanner.stop();

    onMount(() => {
        scanner = new QR(video, (result) => {
            onScan(result.data);
            scanner.stop();
        }, {
            highlightCodeOutline: true,
        });
        scanner.start();
    });
</script>

<style>
    video {
        width: 100%;
        height: auto;
    }
</style>

<video autoplay bind:this={video}></video>