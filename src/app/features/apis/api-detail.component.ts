import { CatalogPermissionsService } from '../../core/services/catalog-permissions.service';
import { confirmMutation } from '../../shared/confirm-mutation';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { readProblem } from '../../core/http/error.interceptor';
import {
  ApiDetailResponse,
  ApiLifecycleStatus,
  ApiVersionResponse,
  AuthenticationProfileType,
  AuthenticationProfileTestResponse,
  AuthenticationType,
  CreateApiVersionRequest,
  CreateEndpointRequest,
  CreateEnvironmentRequest,
  DeploymentEnvironment,
  EndpointAuthenticationMode,
  EndpointResponse,
  EnvironmentResponse,
  UpsertAuthenticationProfileRequest,
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
  readonly catalogPermissions = inject(CatalogPermissionsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  readonly formatter = inject(FormatService);

  private readonly router = inject(Router);
  readonly viewer = !!this.route.snapshot.data['viewer'];
  readonly recordRoot = this.viewer ? '/api-explorer' : '/apis';
  readonly deleting = signal(false);
  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly loading = signal(true);
  readonly api = signal<ApiDetailResponse | null>(null);
  readonly selectedVersionId = signal('');
  readonly canCreate = (versionId?: string) => !this.viewer && this.catalogPermissions.canCreate(this.id, versionId);
  readonly canEdit = (versionId?: string, endpointId?: string, environmentId?: string) => !this.viewer && this.catalogPermissions.canEdit(this.id, versionId, endpointId, environmentId);
  readonly canManage = () => this.canCreate() || this.canEdit();
  readonly canTest = () => !this.viewer && this.auth.hasAnyRole(UserRole.Admin, UserRole.ApiOwner, UserRole.Tester);
  deleteApi(): void {
    if (this.viewer || this.deleting() || !this.catalogPermissions.canDelete(this.id)) return;
    if (!confirmMutation('delete', `${this.api()?.name ?? 'this API'} from the active catalog (it can be restored from Deleted APIs)`)) return;
    this.deleting.set(true);
    this.apiClient.remove(this.id).subscribe({ next: () => { this.toast.success('API moved to Deleted APIs'); void this.router.navigate(['/apis']); }, error: () => { this.deleting.set(false); this.toast.error('Could not delete API'); } });
  }
  readonly lifecycleStatuses = Object.values(ApiLifecycleStatus);
  readonly authenticationTypes = Object.values(AuthenticationType);
  readonly authenticationProfileTypes = Object.values(AuthenticationProfileType);
  readonly environmentTypes = Object.values(DeploymentEnvironment);
  readonly httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
  readonly endpointAuthenticationModes = Object.values(EndpointAuthenticationMode);

  readonly versionModalOpen = signal(false);
  readonly endpointModalOpen = signal(false);
  readonly environmentModalOpen = signal(false);
  readonly secretModalOpen = signal(false);
  readonly authenticationProfileDetailsOpen = signal(false);
  readonly authenticationProfileModalOpen = signal(false);
  readonly editingVersion = signal<ApiVersionResponse | null>(null);
  readonly editingEndpoint = signal<EndpointResponse | null>(null);
  readonly editingEnvironment = signal<EnvironmentResponse | null>(null);
  readonly modalVersion = signal<ApiVersionResponse | null>(null);
  readonly secretEnvironment = signal<EnvironmentResponse | null>(null);
  readonly authenticationProfileDetailsVersion = signal<ApiVersionResponse | null>(null);
  readonly authenticationProfileVersion = signal<ApiVersionResponse | null>(null);
  readonly authenticationTestResult = signal<AuthenticationProfileTestResponse | null>(null);
  readonly authenticationTesting = signal(false);
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
    soapAction: ['', Validators.maxLength(1000)],
    authenticationMode: [EndpointAuthenticationMode.Inherit, Validators.required],
    maxRequestBytes: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(50000000)]),
    maxResponseBytes: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(100000000)]),
    timeoutSeconds: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(300)])
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

  readonly authenticationProfileForm = this.fb.nonNullable.group({
    name: ['Automatic bearer authentication', [Validators.required, Validators.maxLength(200)]],
    type: [AuthenticationProfileType.TokenEndpoint, Validators.required],
    tokenEndpointId: [''],
    tokenJsonPath: ['$.accessToken', [Validators.required, Validators.maxLength(500)]],
    tokenTypeJsonPath: ['$.tokenType', Validators.maxLength(500)],
    expiresAtJsonPath: ['$.expiresAtUtc', Validators.maxLength(500)],
    expiresInJsonPath: ['', Validators.maxLength(500)],
    headerName: ['Authorization', [Validators.required, Validators.pattern(/^[A-Za-z0-9-]{1,100}$/)]],
    refreshSkewSeconds: [60, [Validators.required, Validators.min(0), Validators.max(3600)]],
    isEnabled: [true],
    usernameSecretName: ['BASIC_USERNAME'],
    passwordSecretName: ['BASIC_PASSWORD'],
    apiKeySecretName: ['API_KEY'],
    apiKeyHeaderName: ['X-API-Key'],
    bearerSecretName: ['BEARER_TOKEN'],
    bearerScheme: ['Bearer'],
    customHeadersJson: ['{\n  "headers": {\n    "X-Client-Id": "{{secret:CUSTOM_CLIENT_ID}}"\n  }\n}'],
    certificateSecretName: ['MTLS_CERTIFICATE_PFX'],
    certificatePasswordSecretName: ['MTLS_CERTIFICATE_PASSWORD']
  });

  constructor() { this.catalogPermissions.load(); this.reload(); }

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
    if (!confirmMutation(this.editingVersion() ? 'update' : 'create', 'this API release')) return;
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
    if (!confirmMutation('update', `the release lifecycle to ${lifecycleStatus}`)) return;
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
      soapAction: endpoint?.soapAction ?? '', authenticationMode: endpoint?.authenticationMode ?? EndpointAuthenticationMode.Inherit,
      maxRequestBytes: endpoint?.maxRequestBytes ?? null, maxResponseBytes: endpoint?.maxResponseBytes ?? null,
      timeoutSeconds: endpoint?.timeoutSeconds ?? null
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
        successStatusCodesJson: this.normalizeJson(value.successStatusCodesJson), soapAction: value.soapAction || null,
        authenticationMode: value.authenticationMode,
        maxRequestBytes: value.maxRequestBytes,
        maxResponseBytes: value.maxResponseBytes,
        timeoutSeconds: value.timeoutSeconds
      };
      if (!confirmMutation(this.editingEndpoint() ? 'update' : 'create', 'this API endpoint')) return;
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
    if (!confirmMutation(editing ? 'update' : 'create', 'this API environment')) return;
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
    if (!confirmMutation('save', 'this encrypted environment secret')) return;
    this.modalSaving.set(true);
    this.apiClient.setEnvironmentSecret(this.id, version.id, environment.id, this.secretForm.getRawValue()).subscribe({
      next: () => { this.modalSaving.set(false); this.secretModalOpen.set(false); this.toast.success('Secret encrypted and stored'); this.reload(version.id); },
      error: (error: HttpErrorResponse) => { this.modalSaving.set(false); this.modalError.set(readProblem(error)); }
    });
  }

  openAuthenticationProfileDetails(version: ApiVersionResponse): void {
    this.authenticationProfileDetailsVersion.set(version);
    this.authenticationTestResult.set(null);
    this.authenticationProfileDetailsOpen.set(true);
  }

  closeAuthenticationProfileDetails(): void {
    this.authenticationProfileDetailsOpen.set(false);
    this.authenticationProfileDetailsVersion.set(null);
    this.authenticationTestResult.set(null);
  }

  openAuthenticationProfile(version: ApiVersionResponse): void {
    const profile = version.authenticationProfile;
    const config = this.parseProfileConfiguration(profile?.configurationJson);
    this.authenticationProfileVersion.set(version);
    this.authenticationTestResult.set(null);
    this.modalError.set('');
    this.authenticationProfileForm.reset({
      name: profile?.name ?? 'Automatic bearer authentication',
      type: profile?.type ?? AuthenticationProfileType.TokenEndpoint,
      tokenEndpointId: profile?.tokenEndpointId ?? '',
      tokenJsonPath: profile?.tokenJsonPath ?? '$.accessToken',
      tokenTypeJsonPath: profile?.tokenTypeJsonPath ?? '$.tokenType',
      expiresAtJsonPath: profile?.expiresAtJsonPath ?? '$.expiresAtUtc',
      expiresInJsonPath: profile?.expiresInJsonPath ?? '',
      headerName: profile?.headerName ?? 'Authorization',
      refreshSkewSeconds: profile?.refreshSkewSeconds ?? 60,
      isEnabled: profile?.isEnabled ?? true,
      usernameSecretName: this.configString(config, 'usernameSecretName', 'BASIC_USERNAME'),
      passwordSecretName: this.configString(config, 'passwordSecretName', 'BASIC_PASSWORD'),
      apiKeySecretName: this.configString(config, 'secretName', 'API_KEY'),
      apiKeyHeaderName: this.configString(config, 'headerName', 'X-API-Key'),
      bearerSecretName: this.configString(config, 'secretName', 'BEARER_TOKEN'),
      bearerScheme: this.configString(config, 'scheme', 'Bearer'),
      customHeadersJson: profile?.type === AuthenticationProfileType.CustomHeaders
        ? JSON.stringify(config, null, 2)
        : '{\n  "headers": {\n    "X-Client-Id": "{{secret:CUSTOM_CLIENT_ID}}"\n  }\n}',
      certificateSecretName: this.configString(config, 'certificateSecretName', 'MTLS_CERTIFICATE_PFX'),
      certificatePasswordSecretName: this.configString(config, 'certificatePasswordSecretName', 'MTLS_CERTIFICATE_PASSWORD')
    });
    this.authenticationProfileModalOpen.set(true);
  }

  closeAuthenticationProfileModal(): void {
    this.authenticationProfileModalOpen.set(false);
    this.authenticationProfileVersion.set(null);
    this.authenticationTestResult.set(null);
  }

  saveAuthenticationProfile(): void {
    if (this.authenticationProfileForm.invalid || this.modalSaving()) {
      this.authenticationProfileForm.markAllAsTouched();
      return;
    }
    const version = this.authenticationProfileVersion();
    if (!version) return;
    const value = this.authenticationProfileForm.getRawValue();
    if (this.usesTokenEndpoint(value.type) && !value.tokenEndpointId) {
      this.modalError.set('A token endpoint is required for this authentication type.');
      return;
    }
    let configurationJson: string | null;
    try {
      configurationJson = this.buildProfileConfiguration(value);
    } catch {
      this.modalError.set('The authentication configuration must contain valid JSON.');
      return;
    }
    const request: UpsertAuthenticationProfileRequest = {
      name: value.name,
      type: value.type,
      tokenEndpointId: this.usesTokenEndpoint(value.type) ? value.tokenEndpointId : null,
      tokenJsonPath: value.tokenJsonPath,
      tokenTypeJsonPath: value.tokenTypeJsonPath || null,
      expiresAtJsonPath: value.expiresAtJsonPath || null,
      expiresInJsonPath: value.expiresInJsonPath || null,
      headerName: value.type === AuthenticationProfileType.ApiKey
        ? value.apiKeyHeaderName
        : value.type === AuthenticationProfileType.Basic
          ? 'Authorization'
          : value.type === AuthenticationProfileType.CustomHeaders
            ? 'Custom'
            : value.type === AuthenticationProfileType.MutualTls
              ? 'mTLS'
              : value.headerName,
      refreshSkewSeconds: value.refreshSkewSeconds,
      isEnabled: value.isEnabled,
      configurationJson
    };
    if (!confirmMutation(version.authenticationProfile ? 'update' : 'create', 'this authentication profile')) return;
    this.modalSaving.set(true);
    this.modalError.set('');
    this.apiClient.upsertAuthenticationProfile(this.id, version.id, request).subscribe({
      next: () => {
        this.modalSaving.set(false);
        this.closeAuthenticationProfileModal();
        this.toast.success('Authentication profile saved', 'Inherited endpoints will use the selected authentication strategy.');
        this.reload(version.id);
      },
      error: (error: HttpErrorResponse) => {
        this.modalSaving.set(false);
        this.modalError.set(readProblem(error));
      }
    });
  }

  testAuthenticationProfile(version: ApiVersionResponse, apiEnvironmentId: string): void {
    if (!apiEnvironmentId || this.authenticationTesting()) return;
    this.authenticationTesting.set(true);
    this.authenticationTestResult.set(null);
    this.apiClient.testAuthenticationProfile(this.id, version.id, { apiEnvironmentId }).subscribe({
      next: (result) => {
        this.authenticationTesting.set(false);
        this.authenticationTestResult.set(result);
        this.toast.success('Authentication succeeded', result.summary);
      },
      error: (error: HttpErrorResponse) => {
        this.authenticationTesting.set(false);
        this.toast.error('Authentication test failed', readProblem(error));
      }
    });
  }

  normalizeJson(value?: string | null): string | null {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    return JSON.stringify(JSON.parse(trimmed));
  }

  usesTokenEndpoint(type: AuthenticationProfileType): boolean {
    return type === AuthenticationProfileType.TokenEndpoint || type === AuthenticationProfileType.OAuth2ClientCredentials;
  }

  private parseProfileConfiguration(value?: string | null): Record<string, unknown> {
    if (!value) return {};
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch { return {}; }
  }

  private configString(config: Record<string, unknown>, key: string, fallback: string): string {
    return typeof config[key] === 'string' ? config[key] as string : fallback;
  }

  private buildProfileConfiguration(value: ReturnType<typeof this.authenticationProfileForm.getRawValue>): string | null {
    let configuration: Record<string, unknown> = {};
    switch (value.type) {
      case AuthenticationProfileType.Basic:
        configuration = { usernameSecretName: value.usernameSecretName, passwordSecretName: value.passwordSecretName };
        break;
      case AuthenticationProfileType.ApiKey:
        configuration = { location: 'Header', secretName: value.apiKeySecretName, headerName: value.apiKeyHeaderName };
        break;
      case AuthenticationProfileType.StaticBearer:
        configuration = { secretName: value.bearerSecretName, scheme: value.bearerScheme };
        break;
      case AuthenticationProfileType.CustomHeaders:
        return this.normalizeJson(value.customHeadersJson);
      case AuthenticationProfileType.MutualTls:
        configuration = {
          certificateSecretName: value.certificateSecretName,
          certificatePasswordSecretName: value.certificatePasswordSecretName
        };
        break;
      default:
        return null;
    }
    return JSON.stringify(configuration);
  }

  formatDate(value: string): string { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value)); }
  statusClass(status: string): string { return `status-${status.toLowerCase()}`; }
  lifecycleOrder(status: string): number { return this.lifecycleStatuses.indexOf(status as ApiLifecycleStatus); }
  environmentCode(type: DeploymentEnvironment): string {
    return ({ Development: 'DEV', Uat: 'UAT', Production: 'PRD', DisasterRecovery: 'DR', Sandbox: 'SBX' } as Record<string, string>)[type] ?? type.slice(0, 3).toUpperCase();
  }
}
