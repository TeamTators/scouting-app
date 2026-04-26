<script lang="ts">
    import { onMount } from 'svelte';
    import pdf from 'pdfjs-dist';

    interface Props {
        src: string;
    }

    const { src }: Props = $props();

    let canvas: HTMLCanvasElement;
    let pdfDoc: pdf.PDFDocumentProxy;
    let pageNum: number = 1;

    onMount(() => {
        const loadPDF = async () => {
            pdfDoc = await pdf.getDocument(src).promise;
            renderPage(pageNum);
        };

        const renderPage = async (num: number) => {
            const page = await pdfDoc.getPage(num);
            const viewport = page.getViewport({ scale: 1.5 });
            const context = canvas.getContext('2d');
            if (!context) return;
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            page.render({
                canvas,
                canvasContext: context,
                viewport: viewport
            });
        };

        loadPDF();
    });
</script>

<canvas bind:this={canvas}></canvas>