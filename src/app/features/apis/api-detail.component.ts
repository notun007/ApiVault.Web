import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { readProblem } from '../../core/http/error.interceptor';
import {
  ApiDetailResponse,
  ApiLifecycleStatus,
  ApiVersionResponse,
  AuthenticationType,
  CreateApiVersionRequest,
  CreateEndpointRequest,
  CreateEnvironmentRequest,
  DeploymentEnvironment,
  EndpointResponse,
  EnvironmentResponse,
  UpdateApiVersionRequest
} from '../../core/models/api.models';
import { UserRole } from '../../core/models/security.models';
import { AuthService } from '../../core/auth/auth.service';
import { ApiCatalogClient } from '../../core/services/api-catalog.client';
import { FormatService } from '../../core/services/format.service';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';

@Component({
  selector: 'app-api-detail',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, ModalComponent, EmptyStateComponent, EnumLabelPipe],
  templateUrl: './api-detail.component.html',
  styleUrl: './api-detail.component.scss'
})
export class ApiDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly apiClient = inject(ApiCatalogClient);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  readonly formatter = inject(FormatService);

  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly loading = signal(true);
  readonly api = signal<ApiDetailResponse | null>(null);
  readonly selectedVersionId = signal('');
  readonly canManage = () => this.auth.hasAnyRole(UserRole.Admin, UserRole.ApiOwner);
  readonly lifecycleStatuses = Object.values(ApiLifecycleStatus);
  readonly authenticationTypes = Object.values(AuthenticationType);
  readonly environmentTypes = Object.values(DeploymentEnvironment);
  readonly httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

  readonly versionModalOpen = signal(false);
  readonly endpointModalOpen = signal(false);
  readonly environmentModalOpen = signal(false);
  readonly secretModalOpen = signal(false);
  readonly editingVersion = signal<ApiVersionResponse | null>(null);
  readonly editingEndpoint = signal<EndpointResponse | null>(null);
  readonly editingEnvironment = signal<EnvironmentResponse | null>(null);
  readonly modalVersion = signal<ApiVersionResponse | null>(null);
  readonly secretEnvironment = signal<EnvironmentResponse | null>(null);
  readonly modalSaving = signal(false);
  readonly modalError = signal('');

  readonly sortedVersions = computed(() => [...(this.api()?.versions ?? [])].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || b.version.localeCompare(a.version, undefined, { numeric: true })));
  readonly selectedVersion = computed(() => this.api()?.versions.find((version) => version.id === this.selectedVersionId()) ?? null);

  readonly versionForm = this.fb.nonNullable.group({
    version: ['', [Validators.required, Validators.maxLength(50)]],
    releaseName: ['', Validators.maxLength(200)],
    lifecycleStatus: [ApiLifecycleStatus.Draft, Validators.required],
    releaseDate: [''],
    changeLog: ['', Validators.maxLength(8000)],
    authenticationType: [AuthenticationType.None, Validators.required],
    authenticationInstructions: ['', Validators.maxLength(8000)],
    authenticationConfigJson: [''],
    maxRequestBytes: [1048576, [Validators.required, Validators.min(1), Validators.max(50000000)]],
    maxResponseBytes: [5242880, [Validators.required, Validators.min(1), Validators.max(100000000)]],
    timeoutSeconds: [30, [Validators.required, Validators.min(1), Validators.max(300)]],
    isCurrent: [true]
  });

  readonly endpointForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    relativePath: ['', [Validators.required, Validators.maxLength(1000)]],
    httpMethod: ['GET', Validators.required],
    description: ['', Validators.maxLength(4000)],
    requestHeadersJson: [''],
    queryParametersJson: [''],
    pathParametersJson: [''],
    requestPayloadSample: [''],
    responseHeadersSampleJson: [''],
    responseBodySample: [''],
    successStatusCodesJson: [''],
    soapAction: ['', Validators.maxLength(1000)]
  });

  readonly environmentForm = this.fb.nonNullable.group({
    environmentType: [DeploymentEnvironment.Development, Validators.required],
    baseUrl: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/i)]],
    isEnabled: [true],
    notes: ['', Validators.maxLength(4000)]
  });

  readonly secretForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9_.-]{1,100}$/)]],
    value: ['', [Validators.required, Validators.maxLength(8000)]]
  });

  constructor() { this.reload(); }

  reload(preferredVersionId?: string): void {
    this.apiClient.get(this.id).subscribe({
      next: (api) => {
        this.api.set(api);
        const preferred = preferredVersionId || this.selectedVersionId();
        const selected = api.versions.find((version) => version.id === preferred)
          ?? api.versions.find((version) => version.isCurrent)
          ?? api.versions[0];
        this.selectedVersionId.set(selected?.id ?? '');
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  openCreateVersion(): void {
    this.editingVersion.set(null);
    this.modalError.set('');
    this.versionForm.reset({
      version: '', releaseName: '', lifecycleStatus: ApiLifecycleStatus.Draft, releaseDate: '', changeLog: '',
      authenticationType: AuthenticationType.None, authenticationInstructions: '', authenticationConfigJson: '',
      maxRequestBytes: 1048576, maxResponseBytes: 5242880, timeoutSeconds: 30, isCurrent: true
    });
    this.versionModalOpen.set(true);
  }

  openEditVersion(version: ApiVersionResponse): void {
    this.editingVersion.set(version);
    this.modalError.set('');
    this.versionForm.reset({
      version: version.version,
      releaseName: version.releaseName ?? '',
      lifecycleStatus: version.lifecycleStatus,
      releaseDate: version.releaseDateUtc?.slice(0, 10) ?? '',
      changeLog: version.changeLog ?? '',
      authenticationType: version.authenticationType,
      authenticationInstructions: version.authenticationInstructions ?? '',
      authenticationConfigJson: this.formatter.prettyJson(version.authenticationConfigJson),
      maxRequestBytes: version.maxRequestBytes,
      maxResponseBytes: version.maxResponseBytes,
      timeoutSeconds: version.timeoutSeconds,
      isCurrent: version.isCurrent
    });
    this.versionModalOpen.set(true);
  }

  closeVersionModal(): void { this.versionModalOpen.set(false); this.editingVersion.set(null); }

  saveVersion(): void {
    if (this.versionForm.invalid || this.modalSaving()) { this.versionForm.markAllAsTouched(); return; }
    const value = this.versionForm.getRawValue();
    let authenticationConfigJson: string | null = null;
    try { authenticationConfigJson = this.normalizeJson(value.authenticationConfigJson); } catch { this.modalError.set('Authentication configuration must be valid JSON.'); return; }
    this.modalSaving.set(true);
    this.modalError.set('');
    const common = {
      releaseName: value.releaseName || null,
      releaseDateUtc: value.releaseDate ? `${value.releaseDate}T00:00:00Z` : null,
      changeLog: value.changeLog || null,
      authenticationType: value.authenticationType,
      authenticationInstructions: value.authenticationInstructions || null,
      authenticationConfigJson,
      maxRequestBytes: value.maxRequestBytes,
      maxResponseBytes: value.maxResponseBytes,
      timeoutSeconds: value.timeoutSeconds,
      isCurrent: value.isCurrent
    };
    const editing = this.editingVersion();
    const operation = editing
      ? this.apiClient.updateVersion(this.id, editing.id, common satisfies UpdateApiVersionRequest)
      : this.apiClient.addVersion(this.id, { ...common, version: value.version, lifecycleStatus: value.lifecycleStatus } satisfies CreateApiVersionRequest);
    operation.subscribe({
      next: (version) => { this.modalSaving.set(false); this.closeVersionModal(); this.toast.success(editing ? 'Release metadata updated' : 'Release added'); this.reload(version.id); },
      error: (error: HttpErrorResponse) => { this.modalSaving.set(false); this.modalError.set(readProblem(error)); }
    });
  }

  changeLifecycle(version: ApiVersionResponse, lifecycleStatus: string): void {
    this.apiClient.changeLifecycle(this.id, version.id, lifecycleStatus).subscribe({
      next: () => { this.toast.success('Lifecycle updated', `Release v${version.version} is now ${lifecycleStatus}.`); this.reload(version.id); },
      error: (error: HttpErrorResponse) => this.toast.error('Lifecycle update failed', readProblem(error))
    });
  }

  openEndpoint(version: ApiVersionResponse, endpoint?: EndpointResponse): void {
    this.modalVersion.set(version);
    this.editingEndpoint.set(endpoint ?? null);
    this.modalError.set('');
    this.endpointForm.reset({
      name: endpoint?.name ?? '', relativePath: endpoint?.relativePath ?? '', httpMethod: endpoint?.httpMethod ?? 'GET',
      description: endpoint?.description ?? '', requestHeadersJson: this.formatter.prettyJson(endpoint?.requestHeadersJson),
      queryParametersJson: this.formatter.prettyJson(endpoint?.queryParametersJson), pathParametersJson: this.formatter.prettyJson(endpoint?.pathParametersJson),
      requestPayloadSample: endpoint?.requestPayloadSample ?? '', responseHeadersSampleJson: this.formatter.prettyJson(endpoint?.responseHeadersSampleJson),
      responseBodySample: endpoint?.responseBodySample ?? '', successStatusCodesJson: this.formatter.prettyJson(endpoint?.successStatusCodesJson),
      soapAction: endpoint?.soapAction ?? ''
    });
    this.endpointModalOpen.set(true);
  }

  saveEndpoint(): void {
    if (this.endpointForm.invalid || this.modalSaving()) { this.endpointForm.markAllAsTouched(); return; }
    const version = this.modalVersion();
    if (!version) return;
    const value = this.endpointForm.getRawValue();
    try {
      const request: CreateEndpointRequest = {
        name: value.name, relativePath: value.relativePath, httpMethod: value.httpMethod, description: value.description || null,
        requestHeadersJson: this.normalizeJson(value.requestHeadersJson), queryParametersJson: this.normalizeJson(value.queryParametersJson),
        pathParametersJson: this.normalizeJson(value.pathParametersJson), requestPayloadSample: value.requestPayloadSample || null,
        responseHeadersSampleJson: this.normalizeJson(value.responseHeadersSampleJson), responseBodySample: value.responseBodySample || null,
        successStatusCodesJson: this.normalizeJson(value.successStatusCodesJson), soapAction: value.soapAction || null
      };
      this.modalSaving.set(true);
      const editing = this.editingEndpoint();
      const operation = editing
        ? this.apiClient.updateEndpoint(this.id, version.id, editing.id, request)
        : this.apiClient.addEndpoint(this.id, version.id, request);
      operation.subscribe({
        next: () => { this.modalSaving.set(false); this.endpointModalOpen.set(false); this.toast.success(editing ? 'Endpoint updated' : 'Endpoint added'); this.reload(version.id); },
        error: (error: HttpErrorResponse) => { this.modalSaving.set(false); this.modalError.set(readProblem(error)); }
      });
    } catch { this.modalError.set('All JSON fields must contain valid JSON.'); }
  }

  openEnvironment(version: ApiVersionResponse, environment?: EnvironmentResponse): void {
    this.modalVersion.set(version);
    this.editingEnvironment.set(environment ?? null);
    this.modalError.set('');
    this.environmentForm.reset({
      environmentType: environment?.environmentType ?? DeploymentEnvironment.Development,
      baseUrl: environment?.baseUrl ?? '',
      isEnabled: environment?.isEnabled ?? true,
      notes: environment?.notes ?? ''
    });
    this.environmentModalOpen.set(true);
  }

  saveEnvironment(): void {
    if (this.environmentForm.invalid || this.modalSaving()) { this.environmentForm.markAllAsTouched(); return; }
    const version = this.modalVersion();
    if (!version) return;
    const value = this.environmentForm.getRawValue();
    const request: CreateEnvironmentRequest = { ...value, notes: value.notes || null };
    const editing = this.editingEnvironment();
    this.modalSaving.set(true);
    const operation = editing
      ? this.apiClient.updateEnvironment(this.id, version.id, editing.id, request)
      : this.apiClient.addEnvironment(this.id, version.id, request);
    operation.subscribe({
      next: () => { this.modalSaving.set(false); this.environmentModalOpen.set(false); this.toast.success(editing ? 'Environment updated' : 'Environment added'); this.reload(version.id); },
      error: (error: HttpErrorResponse) => { this.modalSaving.set(false); this.modalError.set(readProblem(error)); }
    });
  }

  openSecret(version: ApiVersionResponse, environment: EnvironmentResponse): void {
    this.modalVersion.set(version);
    this.secretEnvironment.set(environment);
    this.secretForm.reset({ name: '', value: '' });
    this.modalError.set('');
    this.secretModalOpen.set(true);
  }

  saveSecret(): void {
    if (this.secretForm.invalid || this.modalSaving()) { this.secretForm.markAllAsTouched(); return; }
    const version = this.modalVersion();
    const environment = this.secretEnvironment();
    if (!version || !environment) return;
    this.modalSaving.set(true);
    this.apiClient.setEnvironmentSecret(this.id, version.id, environment.id, this.secretForm.getRawValue()).subscribe({
      next: () => { this.modalSaving.set(false); this.secretModalOpen.set(false); this.toast.success('Secret encrypted and stored'); this.reload(version.id); },
      error: (error: HttpErrorResponse) => { this.modalSaving.set(false); this.modalError.set(readProblem(error)); }
    });
  }

  normalizeJson(value?: string | null): string | null {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    return JSON.stringify(JSON.parse(trimmed));
  }

  formatDate(value: string): string { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value)); }
  statusClass(status: string): string { return `status-${status.toLowerCase()}`; }
  lifecycleOrder(status: string): number { return this.lifecycleStatuses.indexOf(status as ApiLifecycleStatus); }
  environmentCode(type: DeploymentEnvironment): string {
    return ({ Development: 'DEV', Uat: 'UAT', Production: 'PRD', DisasterRecovery: 'DR', Sandbox: 'SBX' } as Record<string, string>)[type] ?? type.slice(0, 3).toUpperCase();
  }
}
