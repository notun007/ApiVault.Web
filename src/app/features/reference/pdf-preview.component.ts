import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, signal, ViewChild } from '@angular/core';
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist';

@Component({
  selector: 'app-pdf-preview', standalone: true,
  templateUrl: './pdf-preview.component.html',
  styleUrl: './pdf-preview.component.scss'
})
export class PdfPreviewComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() blob: Blob | null = null;
  @ViewChild('canvas', { static: true }) private canvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('stage', { static: true }) private stage!: ElementRef<HTMLElement>;
  private pdf?: PDFDocumentProxy;
  private load?: PDFDocumentLoadingTask;
  private render?: RenderTask;
  private ready = false;
  private destroyed = false;
  private renderRequest = 0;
  private resize?: ResizeObserver;
  private resizeTimer?: ReturnType<typeof setTimeout>;
  readonly page = signal(1);
  readonly pages = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');

  ngAfterViewInit(): void {
    this.ready = true;
    if (this.blob) void this.loadPdf();
    this.resize = new ResizeObserver(() => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => { if (this.pdf && !this.destroyed) void this.showPage(this.page()); }, 150);
    });
    this.resize.observe(this.stage.nativeElement);
  }
  ngOnChanges(): void { if (this.ready && this.blob) void this.loadPdf(); }

  private async loadPdf(): Promise<void> {
    if (!this.blob) return;
    this.loading.set(true); this.error.set('');
    try {
      const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
      if (this.destroyed) return;
      GlobalWorkerOptions.workerSrc = new URL('pdfjs/pdf.worker.min.mjs', document.baseURI).href;
      this.load = getDocument({ data: new Uint8Array(await this.blob.arrayBuffer()) });
      this.pdf = await this.load.promise;
      if (this.destroyed) return;
      this.pages.set(this.pdf.numPages);
      await this.showPage(1);
    } catch { if (!this.destroyed) { this.error.set('Preview unavailable.'); this.loading.set(false); } }
  }

  async showPage(page: number): Promise<void> {
    if (!this.pdf || this.destroyed || page < 1 || page > this.pdf.numPages || !this.stage.nativeElement.clientWidth) return;
    this.loading.set(true);
    const request = ++this.renderRequest;
    this.render?.cancel();
    await this.render?.promise.catch(() => undefined);
    const pdfPage = await this.pdf.getPage(page);
    if (this.destroyed || request !== this.renderRequest) return;
    const canvas = this.canvas.nativeElement;
    const scale = Math.min((this.stage.nativeElement.clientWidth - 40) / pdfPage.getViewport({ scale: 1 }).width, 1.4);
    const viewport = pdfPage.getViewport({ scale: Math.max(0.2, scale) * Math.min(devicePixelRatio || 1, 2) });
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    canvas.style.width = `${viewport.width / Math.min(devicePixelRatio || 1, 2)}px`;
    this.page.set(page);
    try {
      const task = pdfPage.render({ canvas, viewport });
      this.render = task;
      await task.promise;
      if (this.render === task) this.loading.set(false);
    } catch (error) {
      if ((error as Error).name !== 'RenderingCancelledException' && !this.destroyed) { this.error.set('This page could not be rendered.'); this.loading.set(false); }
    }
  }

  async print(): Promise<void> {
    if (!this.pdf) throw new Error('PDF preview is not ready.');
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;';
    frame.title = 'Printable API documentation';
    document.body.append(frame);
    try {
      const printDoc = frame.contentDocument!;
      printDoc.open(); printDoc.write('<!doctype html><html><head><title>ApiVault documentation</title></head><body></body></html>'); printDoc.close();
      const style = printDoc.createElement('style');
      style.textContent = '@page{size:A4;margin:0}body{margin:0}img{display:block;width:210mm;height:297mm;break-after:page}img:last-child{break-after:auto}';
      printDoc.head.append(style);
      for (let number = 1; number <= this.pdf.numPages; number++) {
        if (this.destroyed) throw new Error('Preview closed.');
        const page = await this.pdf.getPage(number);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, viewport }).promise;
        const image = printDoc.createElement('img'); image.alt = `Page ${number}`; image.src = canvas.toDataURL('image/png'); printDoc.body.append(image); await image.decode();
      }
      frame.contentWindow!.addEventListener('afterprint', () => frame.remove(), { once: true });
      frame.contentWindow!.focus(); frame.contentWindow!.print();
      setTimeout(() => frame.remove(), 120000);
    } catch (error) { frame.remove(); throw error; }
  }

  ngOnDestroy(): void {
    this.destroyed = true; this.resize?.disconnect(); clearTimeout(this.resizeTimer);
    this.render?.cancel(); void this.load?.destroy();
  }
}
