import { AfterViewInit, Component, computed, DestroyRef, ElementRef, inject, OnDestroy, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { createApiReference } from '@scalar/api-reference';
import { ApiCatalogClient } from '../../core/services/api-catalog.client';
import { ToastService } from '../../core/services/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { createCatalogDocument } from './api-document';
import { PdfPreviewComponent } from './pdf-preview.component';

type Format = 'interactive' | 'json' | 'pdf';

@Component({
  selector: 'app-scalar-reference', standalone: true,
  imports: [RouterLink, PageHeaderComponent, PdfPreviewComponent],
  templateUrl: './scalar-reference.component.html', styleUrl: './scalar-reference.component.scss'
})
export class ScalarReferenceComponent implements AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly client = inject(ApiCatalogClient);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild('scalarHost', { static: true }) private scalarHost!: ElementRef<HTMLElement>;
  @ViewChild(PdfPreviewComponent) private pdfPreview?: PdfPreviewComponent;
  private reference?: ReturnType<typeof createApiReference>;
  private destroyed = false;

  readonly recordRoot = this.route.snapshot.data['viewer'] ? '/api-explorer' : '/apis';
  readonly apiId = this.route.snapshot.paramMap.get('apiId') ?? '';
  readonly versionId = this.route.snapshot.paramMap.get('versionId') ?? '';
  readonly loading = signal(true);
  readonly error = signal('');
  readonly document = signal<Record<string, any> | null>(null);
  readonly format = signal<Format>(this.initialFormat());
  readonly title = computed(() => this.document()?.['info']['title'] ?? 'API documentation');
  readonly version = computed(() => this.document()?.['info']['version'] ?? '');
  readonly json = computed(() => JSON.stringify(this.document(), null, 2));
  readonly pdfLoading = signal(false);
  readonly pdfError = signal('');
  readonly pdfBlob = signal<Blob | null>(null);
  readonly printing = signal(false);

  ngAfterViewInit(): void {
    this.client.get(this.apiId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: api => {
        const release = api.versions.find(v => v.id === this.versionId);
        if (!release) {
          this.error.set('This release is unavailable or you do not have access to it.'); this.loading.set(false); return;
        }
        try {
          const document = createCatalogDocument(api, release);
          this.document.set(document);
          this.reference = createApiReference(this.scalarHost.nativeElement, {
            content: document, theme: 'default', layout: 'modern', darkMode: false,
            documentDownloadType: 'none', hideTestRequestButton: true, showSidebar: true,
            // Keep private catalog content inside ApiVault rather than online tooling.
            hideClientButton: true, showDeveloperTools: 'never',
            telemetry: false, persistAuth: false, withDefaultFonts: false, mcp: { disabled: true },
            customCss: '.scalar-app { --scalar-color-accent: #0d766e; --scalar-background-1: #ffffff; }'
          });
          this.loading.set(false);
          if (this.format() === 'pdf') void this.preparePdf();
        } catch {
          this.error.set('The documentation could not be generated for this release.'); this.loading.set(false);
        }
      },
      error: () => { this.error.set('The release could not be loaded. Check your access and try again.'); this.loading.set(false); }
    });
  }

  private initialFormat(): Format {
    const value = this.route.snapshot.queryParamMap.get('format');
    return value === 'json' || value === 'pdf' ? value : 'interactive';
  }

  selectFormat(format: Format): void {
    this.format.set(format);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { format }, queryParamsHandling: 'merge', replaceUrl: true });
    if (format === 'pdf') void this.preparePdf();
  }

  changeTab(event: KeyboardEvent, current: Format): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const formats: Format[] = ['interactive', 'json', 'pdf'];
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!offset && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'interactive' : event.key === 'End' ? 'pdf' : formats[(formats.indexOf(current) + offset + 3) % 3];
    this.selectFormat(next);
    (event.currentTarget as HTMLElement).parentElement?.querySelector<HTMLButtonElement>(`#format-${next}`)?.focus();
  }

  async copyJson(): Promise<void> {
    try { await navigator.clipboard.writeText(this.json()); this.toast.success('OpenAPI JSON copied'); }
    catch { this.toast.error('Copy unavailable', 'Use Download JSON instead.'); }
  }

  downloadJson(): void {
    if (this.document()) this.save(new Blob([this.json()], { type: 'application/json' }), 'openapi.json');
  }

  async preparePdf(): Promise<void> {
    if (!this.document() || this.pdfBlob() || this.pdfLoading()) return;
    this.pdfLoading.set(true); this.pdfError.set('');
    try {
      const { createDocumentPdf } = await import('./document-pdf');
      const blob = createDocumentPdf(this.document()!);
      if (this.destroyed) return;
      this.pdfBlob.set(blob);
    } catch { if (!this.destroyed) this.pdfError.set('The PDF could not be generated. Please retry.'); }
    finally { if (!this.destroyed) this.pdfLoading.set(false); }
  }

  downloadPdf(): void { const blob = this.pdfBlob(); if (blob) this.save(blob, 'reference.pdf'); }
  pdfPreviewReady(): boolean { return (this.pdfPreview?.pages() ?? 0) > 0 && !this.pdfPreview?.error(); }
  async printPdf(): Promise<void> {
    if (!this.pdfPreview || this.printing()) return;
    this.printing.set(true);
    try { await this.pdfPreview.print(); }
    catch { this.toast.error('Printing unavailable', 'Download the PDF and print it from your PDF reader.'); }
    finally { this.printing.set(false); }
  }

  private save(blob: Blob, suffix: string): void {
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    const name = String(this.title()).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'api';
    link.href = url; link.download = `${name}-${String(this.version()).replace(/[^a-z0-9._-]+/gi, '-')}-${suffix}`;
    link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.reference?.destroy();
  }
}
