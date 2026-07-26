import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { readProblem } from '../../core/http/error.interceptor';
import { ApiDetailResponse, ApiSummaryResponse, ApiVersionResponse, EndpointResponse, EnvironmentResponse } from '../../core/models/api.models';
import { TestExecutionResponse } from '../../core/models/test.models';
import { ApiCatalogClient } from '../../core/services/api-catalog.client';
import { FormatService } from '../../core/services/format.service';
import { TestClient } from '../../core/services/test.client';
import { ToastService } from '../../core/services/toast.service';
import { KeyValueEditorComponent, KeyValueRow } from '../../shared/components/key-value-editor.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';

@Component({
  selector: 'app-test-console',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, KeyValueEditorComponent, EnumLabelPipe],
  templateUrl: './test-console.component.html',
  styleUrl: './test-console.component.scss'
})
export class TestConsoleComponent {
  private readonly apiClient = inject(ApiCatalogClient);
  private readonly testClient = inject(TestClient);
  private readonly toast = inject(ToastService);
  readonly formatter = inject(FormatService);

  readonly apis = signal<ApiSummaryResponse[]>([]);
  readonly apiDetail = signal<ApiDetailResponse | null>(null);
  readonly activeTab = signal('path');
  readonly responseTab = signal('body');
  readonly executing = signal(false);
  readonly result = signal<TestExecutionResponse | null>(null);
  readonly executionError = signal('');

  readonly selectedApiId = signal('');
  readonly selectedVersionId = signal('');
  readonly selectedEndpointId = signal('');
  readonly selectedEnvironmentId = signal('');
  pathRows: KeyValueRow[] = [];
  queryRows: KeyValueRow[] = [];
  headerRows: KeyValueRow[] = [];
  body = '';
  timeoutSeconds: number | null = null;

  readonly versions = computed(() => this.apiDetail()?.versions ?? []);
  readonly selectedVersion = computed(() => this.versions().find((version) => version.id === this.selectedVersionId()) ?? null);
  readonly endpoints = computed(() => this.selectedVersion()?.endpoints ?? []);
  readonly environments = computed(() => this.selectedVersion()?.environments ?? []);
  readonly selectedEndpoint = computed(() => this.endpoints().find((endpoint) => endpoint.id === this.selectedEndpointId()) ?? null);
  readonly selectedEnvironment = computed(() => this.environments().find((environment) => environment.id === this.selectedEnvironmentId()) ?? null);

  readonly tabs = [
    { id: 'path', label: 'Path', count: () => this.enabledCount(this.pathRows) },
    { id: 'query', label: 'Query', count: () => this.enabledCount(this.queryRows) },
    { id: 'headers', label: 'Headers', count: () => this.enabledCount(this.headerRows) },
    { id: 'body', label: 'Body', count: () => this.body.trim() ? 1 : 0 },
    { id: 'settings', label: 'Controls', count: () => 0 }
  ];

  constructor() {
    this.apiClient.search({ page: 1, pageSize: 200 }).subscribe((result) => this.apis.set(result.items));
  }

  selectApi(apiId: string): void {
    this.selectedApiId.set(apiId);
    this.selectedVersionId.set('');
    this.selectedEndpointId.set('');
    this.selectedEnvironmentId.set('');
    this.apiDetail.set(null);
    this.resetRequest(false);
    if (!apiId) return;
    this.apiClient.get(apiId).subscribe((api) => {
      this.apiDetail.set(api);
      const current = api.versions.find((version) => version.isCurrent) ?? api.versions[0];
      if (current) {
        this.selectedVersionId.set(current.id);
        this.selectVersion(current.id);
      }
    });
  }

  selectVersion(versionId: string): void {
    this.selectedVersionId.set(versionId);
    this.selectedEndpointId.set('');
    this.selectedEnvironmentId.set('');
    this.resetRequest(false);
    const version = this.versions().find((item) => item.id === versionId);
    if (!version) return;
    const endpoint = version.endpoints[0];
    const environment = version.environments.find((item) => item.isEnabled);
    if (endpoint) { this.selectedEndpointId.set(endpoint.id); this.selectEndpoint(endpoint.id); }
    if (environment) this.selectedEnvironmentId.set(environment.id);
  }

  selectEndpoint(endpointId: string): void {
    this.selectedEndpointId.set(endpointId);
    const endpoint = this.endpoints().find((item) => item.id === endpointId);
    this.pathRows = this.rowsFromJson(endpoint?.pathParametersJson);
    this.queryRows = this.rowsFromJson(endpoint?.queryParametersJson);
    this.headerRows = this.rowsFromJson(endpoint?.requestHeadersJson, true);
    this.body = endpoint?.requestPayloadSample ?? '';
    this.result.set(null);
    this.executionError.set('');
  }

  canExecute(): boolean {
    return !!this.selectedEndpointId() && !!this.selectedEnvironmentId() && !!this.selectedEnvironment()?.isEnabled;
  }

  execute(): void {
    if (!this.canExecute() || this.executing()) return;
    this.executing.set(true);
    this.result.set(null);
    this.executionError.set('');
    this.testClient.execute({
      apiEndpointId: this.selectedEndpointId(),
      apiEnvironmentId: this.selectedEnvironmentId(),
      pathParameters: this.toRecord(this.pathRows),
      queryParameters: this.toRecord(this.queryRows),
      headers: this.toRecord(this.headerRows),
      body: this.body.trim() || null,
      timeoutSeconds: this.timeoutSeconds || null
    }).subscribe({
      next: (response) => {
        this.result.set(response);
        this.executing.set(false);
        this.responseTab.set('body');
        this.toast.show(response.isSuccess ? 'success' : 'warning', response.isSuccess ? 'API test completed' : 'API test returned a failure', `${response.responseStatusCode ?? 'No status'} in ${response.durationMilliseconds} ms`);
      },
      error: (error: HttpErrorResponse) => {
        this.executing.set(false);
        this.executionError.set(readProblem(error));
      }
    });
  }

  resetRequest(clearSelection = false): void {
    this.pathRows = [];
    this.queryRows = [];
    this.headerRows = [];
    this.body = '';
    this.timeoutSeconds = null;
    this.result.set(null);
    this.executionError.set('');
    if (clearSelection) {
      this.selectedApiId.set('');
      this.selectedVersionId.set('');
      this.selectedEndpointId.set('');
      this.selectedEnvironmentId.set('');
      this.apiDetail.set(null);
    } else if (this.selectedEndpointId()) {
      const endpoint = this.selectedEndpoint();
      this.pathRows = this.rowsFromJson(endpoint?.pathParametersJson);
      this.queryRows = this.rowsFromJson(endpoint?.queryParametersJson);
      this.headerRows = this.rowsFromJson(endpoint?.requestHeadersJson, true);
      this.body = endpoint?.requestPayloadSample ?? '';
    }
  }

  rowsFromJson(json?: string | null, preserveValues = false): KeyValueRow[] {
    if (!json) return [];
    try {
      const parsed = JSON.parse(json) as Record<string, unknown>;
      if (Array.isArray(parsed)) return parsed.map((value) => ({ key: String(value), value: '', enabled: true }));
      return Object.entries(parsed).map(([key, value]) => ({ key, value: preserveValues && typeof value === 'string' ? value : '', enabled: true }));
    } catch { return []; }
  }

  toRecord(rows: KeyValueRow[]): Record<string, string> {
    return Object.fromEntries(rows.filter((row) => row.enabled && row.key.trim()).map((row) => [row.key.trim(), row.value]));
  }

  enabledCount(rows: KeyValueRow[]): number { return rows.filter((row) => row.enabled && row.key.trim()).length; }
}
