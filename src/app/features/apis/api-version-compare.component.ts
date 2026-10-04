import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiDetailResponse, ApiVersionResponse } from '../../core/models/api.models';
import { ApiCatalogClient } from '../../core/services/api-catalog.client';
import { FormatService } from '../../core/services/format.service';

type CompareTone = 'same' | 'changed' | 'added' | 'missing';

interface CompareRow {
  label: string;
  values: string[];
  tones: CompareTone[];
  different: boolean;
  differenceLabel: string;
  differenceTone: CompareTone;
}

interface CompareSection {
  title: string;
  rows: CompareRow[];
}

@Component({
  selector: 'app-api-version-compare',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './api-version-compare.component.html',
  styleUrl: './api-version-compare.component.scss'
})
export class ApiVersionCompareComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly apiClient = inject(ApiCatalogClient);
  private readonly format = inject(FormatService);
  private readonly missingValue = 'Not available';

  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly api = signal<ApiDetailResponse | null>(null);
  readonly selectedVersionIds = signal<string[]>([]);
  readonly differencesOnly = signal(false);

  readonly orderedVersions = computed(() =>
    [...(this.api()?.versions ?? [])].sort((left, right) =>
      left.version.localeCompare(right.version, undefined, { numeric: true, sensitivity: 'base' })
    )
  );

  readonly selectedVersions = computed(() => {
    const byId = new Map(this.orderedVersions().map((version) => [version.id, version]));
    return this.selectedVersionIds()
      .map((id) => byId.get(id))
      .filter((version): version is ApiVersionResponse => Boolean(version));
  });

  readonly sections = computed<CompareSection[]>(() => {
    const versions = this.selectedVersions();
    if (versions.length < 2) return [];

    const sections: CompareSection[] = [
      {
        title: 'Release overview',
        rows: [
          this.row('Version', versions.map((version) => version.version)),
          this.row('Release name', versions.map((version) => version.releaseName || this.missingValue)),
          this.row('Lifecycle', versions.map((version) => this.toLabel(version.lifecycleStatus))),
          this.row('Release date', versions.map((version) => this.formatDate(version.releaseDateUtc))),
          this.row('Current release', versions.map((version) => version.isCurrent ? 'Yes' : 'No')),
          this.row('Change log', versions.map((version) => version.changeLog || this.missingValue))
        ]
      },
      {
        title: 'Security and limits',
        rows: [
          this.row('Authentication', versions.map((version) => this.toLabel(version.authenticationType))),
          this.row('Authentication instructions', versions.map((version) => version.authenticationInstructions || this.missingValue)),
          this.row('Maximum request', versions.map((version) => this.format.byteSize(version.maxRequestBytes))),
          this.row('Maximum response', versions.map((version) => this.format.byteSize(version.maxResponseBytes))),
          this.row('Timeout', versions.map((version) => `${version.timeoutSeconds} seconds`))
        ]
      },
      {
        title: 'Environments',
        rows: this.environmentRows(versions)
      },
      {
        title: 'Endpoints',
        rows: this.endpointRows(versions)
      },
      {
        title: 'Consumer applications',
        rows: this.consumerRows(versions)
      }
    ];

    if (!this.differencesOnly()) return sections;
    return sections
      .map((section) => ({ ...section, rows: section.rows.filter((row) => row.different) }))
      .filter((section) => section.rows.length > 0);
  });

  readonly summary = computed(() => {
    const rows = this.buildAllRows();
    return {
      differences: rows.filter((row) => row.different).length,
      added: rows.reduce((total, row) => total + row.tones.filter((tone) => tone === 'added').length, 0),
      missing: rows.reduce((total, row) => total + row.tones.filter((tone) => tone === 'missing').length, 0),
      unchanged: rows.filter((row) => !row.different).length
    };
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      this.loadFailed.set(true);
      return;
    }

    this.apiClient.get(id).subscribe({
      next: (api) => {
        this.api.set(api);
        this.selectInitialVersions(api.versions);
        this.loading.set(false);
      },
      error: () => {
        this.loadFailed.set(true);
        this.loading.set(false);
      }
    });
  }

  setSelectedVersion(index: number, event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.selectedVersionIds.update((ids) => ids.map((value, itemIndex) => itemIndex === index ? id : value));
  }

  isVersionSelected(id: string, currentIndex: number): boolean {
    return this.selectedVersionIds().some((selectedId, index) => index !== currentIndex && selectedId === id);
  }

  addVersion(): void {
    if (this.selectedVersionIds().length >= 4) return;
    const selected = new Set(this.selectedVersionIds());
    const next = this.orderedVersions().find((version) => !selected.has(version.id));
    if (next) this.selectedVersionIds.update((ids) => [...ids, next.id]);
  }

  removeVersion(index: number): void {
    if (this.selectedVersionIds().length <= 2) return;
    this.selectedVersionIds.update((ids) => ids.filter((_, itemIndex) => itemIndex !== index));
  }

  reverseVersions(): void {
    this.selectedVersionIds.update((ids) => [...ids].reverse());
  }

  canAddVersion(): boolean {
    return this.selectedVersionIds().length < Math.min(4, this.orderedVersions().length);
  }

  setDifferencesOnly(value: boolean): void {
    this.differencesOnly.set(value);
  }

  toneSymbol(tone: CompareTone): string {
    if (tone === 'added') return '+';
    if (tone === 'missing') return '−';
    if (tone === 'changed') return '~';
    return '✓';
  }

  private selectInitialVersions(versions: ApiVersionResponse[]): void {
    const ordered = [...versions].sort((left, right) =>
      left.version.localeCompare(right.version, undefined, { numeric: true, sensitivity: 'base' })
    );
    let selected = ordered.slice(-4);
    const current = ordered.find((version) => version.isCurrent);
    if (current && !selected.some((version) => version.id === current.id)) {
      selected = [current, ...selected.slice(1)];
      selected.sort((left, right) => ordered.indexOf(left) - ordered.indexOf(right));
    }
    this.selectedVersionIds.set(selected.map((version) => version.id));
  }

  private buildAllRows(): CompareRow[] {
    const versions = this.selectedVersions();
    if (versions.length < 2) return [];
    return [
      this.row('Version', versions.map((version) => version.version)),
      this.row('Release name', versions.map((version) => version.releaseName || this.missingValue)),
      this.row('Lifecycle', versions.map((version) => this.toLabel(version.lifecycleStatus))),
      this.row('Release date', versions.map((version) => this.formatDate(version.releaseDateUtc))),
      this.row('Current release', versions.map((version) => version.isCurrent ? 'Yes' : 'No')),
      this.row('Change log', versions.map((version) => version.changeLog || this.missingValue)),
      this.row('Authentication', versions.map((version) => this.toLabel(version.authenticationType))),
      this.row('Authentication instructions', versions.map((version) => version.authenticationInstructions || this.missingValue)),
      this.row('Maximum request', versions.map((version) => this.format.byteSize(version.maxRequestBytes))),
      this.row('Maximum response', versions.map((version) => this.format.byteSize(version.maxResponseBytes))),
      this.row('Timeout', versions.map((version) => `${version.timeoutSeconds} seconds`)),
      ...this.environmentRows(versions),
      ...this.endpointRows(versions),
      ...this.consumerRows(versions)
    ];
  }

  private environmentRows(versions: ApiVersionResponse[]): CompareRow[] {
    const keys = this.uniqueSorted(versions.flatMap((version) => version.environments.map((item) => item.environmentType)));
    if (keys.length === 0) return [this.row('Environment configuration', versions.map(() => this.missingValue))];
    return keys.map((key) => this.row(this.toLabel(key), versions.map((version) => {
      const environment = version.environments.find((item) => item.environmentType === key);
      if (!environment) return this.missingValue;
      return `${environment.baseUrl} · ${environment.isEnabled ? 'Enabled' : 'Disabled'}`;
    })));
  }

  private endpointRows(versions: ApiVersionResponse[]): CompareRow[] {
    const keys = this.uniqueSorted(versions.flatMap((version) =>
      version.endpoints.map((endpoint) => `${endpoint.httpMethod.toUpperCase()} ${endpoint.relativePath}`)
    ));
    if (keys.length === 0) return [this.row('Endpoint definitions', versions.map(() => this.missingValue))];
    return keys.map((key) => this.row(key, versions.map((version) => {
      const endpoint = version.endpoints.find((item) => `${item.httpMethod.toUpperCase()} ${item.relativePath}` === key);
      if (!endpoint) return this.missingValue;
      return endpoint.description || endpoint.name || 'Available';
    })));
  }

  private consumerRows(versions: ApiVersionResponse[]): CompareRow[] {
    const keys = this.uniqueSorted(versions.flatMap((version) => version.consumers.map((consumer) => consumer.projectCode)));
    if (keys.length === 0) return [this.row('Linked consumers', versions.map(() => this.missingValue))];
    return keys.map((key) => this.row(key, versions.map((version) => {
      const consumer = version.consumers.find((item) => item.projectCode === key);
      if (!consumer) return this.missingValue;
      return `${consumer.projectName} · ${consumer.isRequired ? 'Required' : 'Optional'}`;
    })));
  }

  private row(label: string, values: string[]): CompareRow {
    const normalized = values.map((value) => value.trim().toLowerCase());
    const different = new Set(normalized).size > 1;
    const hasMissing = values.some((value) => value === this.missingValue);
    const tones: CompareTone[] = values.map((value) => {
      if (!different) return 'same';
      if (value === this.missingValue) return 'missing';
      if (hasMissing) return 'added';
      return 'changed';
    });

    let differenceLabel = '';
    let differenceTone: CompareTone = 'same';
    if (different && hasMissing) {
      const versionLabels = this.selectedVersions().map((version) => version.version);
      const presentIndexes = values.map((value, index) => value === this.missingValue ? -1 : index).filter((index) => index >= 0);
      const missingIndexes = values.map((value, index) => value === this.missingValue ? index : -1).filter((index) => index >= 0);
      if (presentIndexes.length === 1) {
        differenceLabel = `Only in ${versionLabels[presentIndexes[0]]}`;
        differenceTone = 'added';
      } else if (missingIndexes.length === 1) {
        differenceLabel = `Missing in ${versionLabels[missingIndexes[0]]}`;
        differenceTone = 'missing';
      } else {
        differenceLabel = 'Availability differs';
        differenceTone = 'missing';
      }
    } else if (different) {
      differenceLabel = 'Changed across versions';
      differenceTone = 'changed';
    }

    return { label, values, tones, different, differenceLabel, differenceTone };
  }

  private uniqueSorted(values: string[]): string[] {
    return [...new Set(values)].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  }

  private formatDate(value?: string | null): string {
    if (!value) return this.missingValue;
    return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  }

  private toLabel(value: string): string {
    return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (character) => character.toUpperCase());
  }
}
