import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { readProblem } from '../../core/http/error.interceptor';
import {
  ApiAccessCatalogApiResponse, ApiAccessCatalogApplicationResponse, ApiAccessCatalogEnvironmentResponse,
  ApiAccessCatalogReleaseResponse, SaveUserApiAccessGrantRequest,
  UserAccessResponse, UserApiAccessGrantResponse
} from '../../core/models/security.models';
import { AdminClient } from '../../core/services/admin.client';
import { SecurityClient } from '../../core/services/security.client';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

type AccessView = 'assignments' | 'scope' | 'effective';

interface ApplicationAccessSummary {
  applicationId: string;
  applicationCode: string;
  applicationName: string;
  apiCount: number;
  releaseCount: number;
  endpointCount: number;
  environments: string[];
  canRead: boolean;
  canCreate: boolean;
  canEdit: boolean;
}

@Component({
  selector: 'app-api-access',
  standalone: true,
  imports: [PageHeaderComponent, EmptyStateComponent],
  templateUrl: './api-access.component.html',
  styleUrl: './api-access.component.scss'
})
export class ApiAccessComponent {
  private readonly admin = inject(AdminClient);
  private readonly security = inject(SecurityClient);
  private readonly toast = inject(ToastService);

  readonly users = signal<UserAccessResponse[]>([]);
  readonly catalog = signal<ApiAccessCatalogApplicationResponse[]>([]);
  readonly grants = signal<UserApiAccessGrantResponse[]>([]);
  readonly selectedUserId = signal('');
  readonly view = signal<AccessView>('assignments');
  readonly selectedApplicationId = signal('');
  readonly selectedApiIds = signal<string[]>([]);
  readonly selectedReleaseIds = signal<string[]>([]);
  readonly selectedEndpointIds = signal<string[]>([]);
  readonly selectedEnvironmentIds = signal<string[]>([]);
  readonly canCreate = signal(false);
  readonly canEdit = signal(false);
  readonly effectiveApplicationId = signal('');
  readonly loading = signal(true);
  readonly loadingGrants = signal(false);
  readonly savingAccess = signal(false);
  readonly errorMessage = signal('');

  readonly selectedUser = computed(() => this.users().find(user => user.userId === this.selectedUserId()));
  readonly selectedApplication = computed(() => this.catalog().find(application => application.id === this.selectedApplicationId()));
  readonly availableApis = computed(() => this.selectedApplication()?.apis ?? []);
  readonly availableReleases = computed(() => this.availableApis().flatMap(api =>
    this.selectedApiIds().includes(api.id) ? api.releases.map(release => ({ ...release, apiId: api.id, apiName: api.name })) : []));
  readonly availableEndpoints = computed(() => this.availableReleases().flatMap(release =>
    this.selectedReleaseIds().includes(release.id) ? release.endpoints.map(endpoint => ({ ...endpoint, releaseId: release.id, releaseVersion: release.version })) : []));
  readonly availableEnvironments = computed(() => this.availableReleases().flatMap(release =>
    this.selectedReleaseIds().includes(release.id) ? release.environments.map(environment => ({ ...environment, releaseId: release.id, releaseVersion: release.version })) : []));
  readonly effectiveGrants = computed(() => this.effectiveApplicationId()
    ? this.grants().filter(grant => grant.applicationId === this.effectiveApplicationId())
    : this.grants());
  readonly canSaveScope = computed(() => !!this.selectedApplicationId() && this.selectedEndpointIds().length > 0 &&
    this.selectedEndpointIds().every(endpointId => {
      const releaseId = this.findReleaseForEndpoint(endpointId)?.id;
      return !!releaseId && this.availableEnvironments().some(environment => environment.releaseId === releaseId && this.selectedEnvironmentIds().includes(environment.id));
    }));

  constructor() {
    forkJoin({ users: this.admin.getUserAccess(), catalog: this.security.getApiAccessCatalog() }).subscribe({
      next: ({ users, catalog }) => {
        this.users.set(users);
        this.catalog.set(catalog);
        this.loading.set(false);
        if (users.length > 0) this.selectUser(users[0].userId);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(readProblem(error, 'Could not load user access data.'));
      }
    });
  }

  selectUser(userId: string): void {
    this.selectedUserId.set(userId);
    this.view.set('assignments');
    this.effectiveApplicationId.set('');
    this.loadGrants(userId);
  }

  setView(view: AccessView): void {
    if (view === 'scope' && !this.selectedApplicationId()) this.openScope();
    else this.view.set(view);
  }

  applicationSummaries(): ApplicationAccessSummary[] {
    const groups = new Map<string, UserApiAccessGrantResponse[]>();
    for (const grant of this.grants()) groups.set(grant.applicationId, [...(groups.get(grant.applicationId) ?? []), grant]);
    return [...groups.values()].map(items => ({
      applicationId: items[0].applicationId,
      applicationCode: items[0].applicationCode,
      applicationName: items[0].applicationName,
      apiCount: new Set(items.map(item => item.apiAssetId)).size,
      releaseCount: new Set(items.map(item => item.apiVersionId)).size,
      endpointCount: new Set(items.map(item => item.apiEndpointId)).size,
      environments: [...new Set(items.map(item => item.environmentType))],
      canRead: items.some(item => item.canRead),
      canCreate: items.some(item => item.canCreate),
      canEdit: items.some(item => item.canEdit)
    })).sort((a, b) => a.applicationName.localeCompare(b.applicationName));
  }

  uniqueReleaseCount(): number { return new Set(this.grants().map(grant => grant.apiVersionId)).size; }
  uniqueEnvironmentCount(): number { return new Set(this.grants().map(grant => grant.apiEnvironmentId)).size; }

  openScope(applicationId?: string): void {
    const id = applicationId ?? this.catalog()[0]?.id ?? '';
    this.selectedApplicationId.set(id);
    this.loadScopeFromGrants(id);
    this.view.set('scope');
  }

  chooseApplication(applicationId: string): void {
    this.selectedApplicationId.set(applicationId);
    this.loadScopeFromGrants(applicationId);
  }

  toggleApi(apiId: string): void {
    this.selectedApiIds.update(ids => this.toggle(ids, apiId));
    const allowedReleaseIds = new Set(this.availableApis().filter(api => this.selectedApiIds().includes(api.id)).flatMap(api => api.releases.map(release => release.id)));
    this.selectedReleaseIds.update(ids => ids.filter(id => allowedReleaseIds.has(id)));
    this.trimResourceSelections();
  }

  toggleRelease(releaseId: string): void { this.selectedReleaseIds.update(ids => this.toggle(ids, releaseId)); this.trimResourceSelections(); }
  toggleEndpoint(endpointId: string): void { this.selectedEndpointIds.update(ids => this.toggle(ids, endpointId)); }
  toggleEnvironment(environmentId: string): void { this.selectedEnvironmentIds.update(ids => this.toggle(ids, environmentId)); }
  includes(ids: string[], id: string): boolean { return ids.includes(id); }
  apiNameForRelease(releaseId: string): string { return this.availableReleases().find(release => release.id === releaseId)?.apiName ?? ''; }
  environmentLabel(environment: ApiAccessCatalogEnvironmentResponse): string { return environment.isEnabled ? environment.environmentType : `${environment.environmentType} (disabled)`; }

  saveScope(): void {
    if (!this.canSaveScope() || this.savingAccess()) return;
    const currentApplicationId = this.selectedApplicationId();
    const retained = this.grants().filter(grant => grant.applicationId !== currentApplicationId).map(grant => this.toSaveRequest(grant));
    this.saveAccess([...retained, ...this.buildScopeRequests()], 'API access saved');
  }

  removeApplicationAccess(applicationId: string): void {
    if (!confirm('Remove all API access for this application?')) return;
    this.saveAccess(this.grants().filter(grant => grant.applicationId !== applicationId).map(grant => this.toSaveRequest(grant)), 'Application access removed');
  }

  setEffectiveApplication(applicationId: string): void { this.effectiveApplicationId.set(applicationId); }

  private loadGrants(userId: string): void {
    this.loadingGrants.set(true);
    this.security.getUserApiAccess(userId).subscribe({
      next: grants => { this.grants.set(grants); this.loadingGrants.set(false); },
      error: (error: HttpErrorResponse) => {
        this.loadingGrants.set(false);
        this.errorMessage.set(readProblem(error, 'Could not load API access grants.'));
      }
    });
  }

  private loadScopeFromGrants(applicationId: string): void {
    const grants = this.grants().filter(grant => grant.applicationId === applicationId);
    this.selectedApiIds.set([...new Set(grants.map(grant => grant.apiAssetId))]);
    this.selectedReleaseIds.set([...new Set(grants.map(grant => grant.apiVersionId))]);
    this.selectedEndpointIds.set([...new Set(grants.map(grant => grant.apiEndpointId))]);
    this.selectedEnvironmentIds.set([...new Set(grants.map(grant => grant.apiEnvironmentId))]);
    this.canCreate.set(grants.some(grant => grant.canCreate));
    this.canEdit.set(grants.some(grant => grant.canEdit));
  }

  private trimResourceSelections(): void {
    const endpointIds = new Set(this.availableEndpoints().map(endpoint => endpoint.id));
    const environmentIds = new Set(this.availableEnvironments().map(environment => environment.id));
    this.selectedEndpointIds.update(ids => ids.filter(id => endpointIds.has(id)));
    this.selectedEnvironmentIds.update(ids => ids.filter(id => environmentIds.has(id)));
  }

  private buildScopeRequests(): SaveUserApiAccessGrantRequest[] {
    const result: SaveUserApiAccessGrantRequest[] = [];
    for (const endpointId of this.selectedEndpointIds()) {
      const release = this.findReleaseForEndpoint(endpointId);
      const api = release ? this.findApiForRelease(release.id) : undefined;
      if (!release || !api) continue;
      for (const environment of release.environments.filter(item => this.selectedEnvironmentIds().includes(item.id))) {
        result.push({ applicationId: this.selectedApplicationId(), apiAssetId: api.id, apiVersionId: release.id,
          apiEndpointId: endpointId, apiEnvironmentId: environment.id, canRead: true,
          canCreate: this.canCreate(), canEdit: this.canEdit() });
      }
    }
    return result;
  }

  private findReleaseForEndpoint(endpointId: string): ApiAccessCatalogReleaseResponse | undefined {
    return this.selectedApplication()?.apis.flatMap(api => api.releases).find(release => release.endpoints.some(endpoint => endpoint.id === endpointId));
  }

  private findApiForRelease(releaseId: string): ApiAccessCatalogApiResponse | undefined {
    return this.selectedApplication()?.apis.find(api => api.releases.some(release => release.id === releaseId));
  }

  private saveAccess(grants: SaveUserApiAccessGrantRequest[], message: string): void {
    const userId = this.selectedUserId();
    if (!userId) return;
    this.savingAccess.set(true);
    this.security.updateUserApiAccess(userId, { grants }).subscribe({
      next: () => {
        this.savingAccess.set(false);
        this.toast.success(message);
        this.view.set('assignments');
        this.loadGrants(userId);
      },
      error: (error: HttpErrorResponse) => {
        this.savingAccess.set(false);
        this.errorMessage.set(readProblem(error, 'Could not save API access.'));
      }
    });
  }

  private toSaveRequest(grant: UserApiAccessGrantResponse): SaveUserApiAccessGrantRequest {
    return { applicationId: grant.applicationId, apiAssetId: grant.apiAssetId, apiVersionId: grant.apiVersionId,
      apiEndpointId: grant.apiEndpointId, apiEnvironmentId: grant.apiEnvironmentId, canRead: grant.canRead,
      canCreate: grant.canCreate, canEdit: grant.canEdit };
  }

  private toggle(ids: string[], id: string): string[] { return ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]; }
}
