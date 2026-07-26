import { AfterViewInit, Component, ElementRef, inject, OnDestroy, signal, ViewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { createApiReference } from '@scalar/api-reference';
import { ApiCatalogClient } from '../../core/services/api-catalog.client';
import { ToastService } from '../../core/services/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-scalar-reference',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent],
  templateUrl: './scalar-reference.component.html',
  styleUrl: './scalar-reference.component.scss'
})
export class ScalarReferenceComponent implements AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly client = inject(ApiCatalogClient);
  private readonly toast = inject(ToastService);
  @ViewChild('scalarHost', { static: true }) private scalarHost!: ElementRef<HTMLElement>;

  readonly apiId = this.route.snapshot.paramMap.get('apiId') ?? '';
  readonly versionId = this.route.snapshot.paramMap.get('versionId') ?? '';
  readonly loading = signal(true);
  readonly error = signal('');
  readonly document = signal<Record<string, unknown> | null>(null);

  ngAfterViewInit(): void {
    this.client.getOpenApi(this.versionId).subscribe({
      next: (document) => {
        this.document.set(document);
        this.render(document);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('The OpenAPI document could not be generated for this release.');
        this.loading.set(false);
      }
    });
  }

  ngOnDestroy(): void {
    this.scalarHost.nativeElement.replaceChildren();
  }

  download(): void {
    const document = this.document();
    if (!document) return;
    const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `apivault-${this.versionId}-openapi.json`;
    link.click();
    URL.revokeObjectURL(url);
    this.toast.success('OpenAPI document downloaded');
  }

  private render(document: Record<string, unknown>): void {
    this.scalarHost.nativeElement.replaceChildren();
    createApiReference(this.scalarHost.nativeElement, {
      content: document,
      theme: 'default',
      layout: 'modern',
      darkMode: false,
      hideDownloadButton: false,
      hideTestRequestButton: true,
      showSidebar: true,
      metaData: { title: 'ApiVault API Reference' },
      customCss: `
        .scalar-app { --scalar-color-accent: #0d766e; --scalar-background-1: #ffffff; }
        .references-classic .section-container { max-width: 1480px; }
      `
    });
  }
}
