import { confirmMutation } from '../../shared/confirm-mutation';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { readProblem } from '../../core/http/error.interceptor';
import {
  ApiAccessCatalogApplicationResponse,
  SaveUserApiAccessGrantRequest,
  UserAccessResponse,
  UserApiAccessGrantResponse
} from '../../core/models/security.models';
import { AdminClient } from '../../core/services/admin.client';
import { SecurityClient } from '../../core/services/security.client';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

type AccessTab = 'assigned' | 'all';
type PermissionKey = 'canRead' | 'canCreate' | 'canEdit';

interface ResourceRow extends SaveUserApiAccessGrantRequest {
  key: string;
  applicationCode: string;
  applicationName: string;
  apiName: string;
  releaseVersion: string;
  endpointName: string;
  httpMethod: string;
  relativePath: string;
  environmentType: string;
  environmentEnabled: boolean;
}

interface AccessSummary {
  applications: number;
  apis: number;
  releases: number;
  endpoints: number;
  environments: number;
}

@Component({
  selector: 'app-api-access',
  standalone: true,
  imports: [EmptyStateComponent, PageHeaderComponent],
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
  readonly activeTab = signal<AccessTab>('assigned');
  readonly searchTerm = signal('');
  readonly applicationFilter = signal('');
  readonly apiFilter = signal('');
  readonly releaseFilter = signal('');
  readonly environmentFilter = signal('');
  readonly selectedRowKeys = signal<string[]>([]);
  readonly draftAccess = signal<Record<string, SaveUserApiAccessGrantRequest>>({});
  readonly initialAccess = signal<Record<string, SaveUserApiAccessGrantRequest>>({});
  readonly loading = signal(true);
  readonly loadingGrants = signal(false);
  readonly savingAccess = signal(false);
  readonly errorMessage = signal('');

  readonly selectedUser = computed(() => this.users().find(user => user.userId === this.selectedUserId()));

  readonly resourceRows = computed<ResourceRow[]>(() => {
    const rows: ResourceRow[] = [];
    for (const application of this.catalog()) {
      for (const api of application.apis) {
        for (const release of api.releases) {
          for (const endpoint of release.endpoints) {
            for (const environment of release.environments) {
              rows.push({
                key: this.resourceKey(application.id, endpoint.id, environment.id),
                applicationId: application.id,
                applicationCode: application.code,
                applicationName: application.name,
                apiAssetId: api.id,
                apiName: api.name,
                apiVersionId: release.id,
                releaseVersion: release.version,
                apiEndpointId: endpoint.id,
                endpointName: endpoint.name,
                httpMethod: endpoint.httpMethod,
                relativePath: endpoint.relativePath,
                apiEnvironmentId: environment.id,
                environmentType: environment.environmentType,
                environmentEnabled: environment.isEnabled,
                canRead: false,
                canCreate: false,
                canEdit: false
              });
            }
          }
        }
      }
    }
    return rows.sort((a, b) =>
      a.applicationName.localeCompare(b.applicationName) ||
      a.apiName.localeCompare(b.apiName) ||
      a.releaseVersion.localeCompare(b.releaseVersion) ||
      a.relativePath.localeCompare(b.relativePath) ||
      a.environmentType.localeCompare(b.environmentType));
  });

  readonly applicationOptions = computed(() => this.catalog()
    .map(application => ({ id: application.id, label: application.name }))
    .sort((a, b) => a.label.localeCompare(b.label)));

  readonly apiOptions = computed(() => {
    const applicationId = this.applicationFilter();
    return this.catalog()
      .filter(application => !applicationId || application.id === applicationId)
      .flatMap(application => application.apis.map(api => ({ id: api.id, label: api.name })))
      .filter((option, index, options) => options.findIndex(item => item.id === option.id) === index)
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  readonly releaseOptions = computed(() => {
    const applicationId = this.applicationFilter();
    const apiId = this.apiFilter();
    return this.catalog()
      .filter(application => !applicationId || application.id === applicationId)
      .flatMap(application => application.apis)
      .filter(api => !apiId || api.id === apiId)
      .flatMap(api => api.releases.map(release => ({ id: release.id, label: release.version })))
      .filter((option, index, options) => options.findIndex(item => item.id === option.id) === index)
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  readonly environmentOptions = computed(() => this.resourceRows()
    .filter(row => !this.applicationFilter() || row.applicationId === this.applicationFilter())
    .filter(row => !this.apiFilter() || row.apiAssetId === this.apiFilter())
    .filter(row => !this.releaseFilter() || row.apiVersionId === this.releaseFilter())
    .map(row => row.environmentType)
    .filter((environment, index, environments) => environments.indexOf(environment) === index)
    .sort());

  readonly filteredRows = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const draft = this.draftAccess();
    return this.resourceRows()
      .filter(row => this.activeTab() === 'all' || !!draft[row.key])
      .filter(row => !this.applicationFilter() || row.applicationId === this.applicationFilter())
      .filter(row => !this.apiFilter() || row.apiAssetId === this.apiFilter())
      .filter(row => !this.releaseFilter() || row.apiVersionId === this.releaseFilter())
      .filter(row => !this.environmentFilter() || row.environmentType === this.environmentFilter())
      .filter(row => !term || [row.applicationName, row.applicationCode, row.apiName, row.releaseVersion,
        row.endpointName, row.relativePath, row.httpMethod, row.environmentType]
        .some(value => value.toLowerCase().includes(term)));
  });

  readonly assignedCount = computed(() => Object.keys(this.draftAccess()).length);
  readonly selectedCount = computed(() => this.selectedRowKeys().length);
  readonly allVisibleSelected = computed(() => this.filteredRows().length > 0 &&
    this.filteredRows().every(row => this.selectedRowKeys().includes(row.key)));
  readonly selectedHasAssigned = computed(() => this.selectedRowKeys().some(key => !!this.draftAccess()[key]));
  readonly selectedHasUnassigned = computed(() => this.selectedRowKeys().some(key => !this.draftAccess()[key]));
  readonly hasChanges = computed(() => this.serializeAccess(this.draftAccess()) !== this.serializeAccess(this.initialAccess()));
  readonly pendingChangeCount = computed(() => {
    const draft = this.draftAccess();
    const initial = this.initialAccess();
    const keys = [...new Set([...Object.keys(draft), ...Object.keys(initial)])];
    return keys
      .filter(key => JSON.stringify(draft[key] ?? null) !== JSON.stringify(initial[key] ?? null)).length;
  });

  readonly summary = computed<AccessSummary>(() => {
    const assignedRows = this.resourceRows().filter(row => !!this.draftAccess()[row.key]);
    return {
      applications: new Set(assignedRows.map(row => row.applicationId)).size,
      apis: new Set(assignedRows.map(row => row.apiAssetId)).size,
      releases: new Set(assignedRows.map(row => row.apiVersionId)).size,
      endpoints: new Set(assignedRows.map(row => row.apiEndpointId)).size,
      environments: new Set(assignedRows.map(row => row.apiEnvironmentId)).size
    };
  });

  constructor() {
    forkJoin({ users: this.admin.getUserAccess(), catalog: this.security.getApiAccessCatalog() }).subscribe({
      next: ({ users, catalog }) => {
        this.users.set(users);
        this.catalog.set(catalog);
        this.loading.set(false);
        if (users.length > 0) this.selectUser(users[0].userId, false);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(readProblem(error, 'Could not load user access data.'));
      }
    });
  }

  selectUser(userId: string, confirmDiscard = true): void {
    if (!userId || userId === this.selectedUserId()) return;
    if (confirmDiscard && this.hasChanges() && !confirm('Discard unsaved access changes and switch user?')) return;
    this.selectedUserId.set(userId);
    this.activeTab.set('assigned');
    this.clearFilters();
    this.loadGrants(userId);
  }

  setTab(tab: AccessTab): void {
    this.activeTab.set(tab);
    this.selectedRowKeys.set([]);
  }

  setApplicationFilter(applicationId: string): void {
    this.applicationFilter.set(applicationId);
    this.apiFilter.set('');
    this.releaseFilter.set('');
    this.environmentFilter.set('');
    this.selectedRowKeys.set([]);
  }

  setApiFilter(apiId: string): void {
    this.apiFilter.set(apiId);
    this.releaseFilter.set('');
    this.environmentFilter.set('');
    this.selectedRowKeys.set([]);
  }

  setReleaseFilter(releaseId: string): void {
    this.releaseFilter.set(releaseId);
    this.environmentFilter.set('');
    this.selectedRowKeys.set([]);
  }

  setEnvironmentFilter(environment: string): void {
    this.environmentFilter.set(environment);
    this.selectedRowKeys.set([]);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.applicationFilter.set('');
    this.apiFilter.set('');
    this.releaseFilter.set('');
    this.environmentFilter.set('');
    this.selectedRowKeys.set([]);
  }

  isSelected(key: string): boolean { return this.selectedRowKeys().includes(key); }
  isAssigned(key: string): boolean { return !!this.draftAccess()[key]; }

  toggleRowSelection(key: string, selected: boolean): void {
    this.selectedRowKeys.update(keys => selected ? [...new Set([...keys, key])] : keys.filter(item => item !== key));
  }

  toggleAllVisible(selected: boolean): void {
    const visibleKeys = this.filteredRows().map(row => row.key);
    this.selectedRowKeys.update(keys => selected
      ? [...new Set([...keys, ...visibleKeys])]
      : keys.filter(key => !visibleKeys.includes(key)));
  }

  executionProfile(row: ResourceRow): string {
    const value = this.draftAccess()[row.key];
    return !value?.canRead ? 'none' : value.canCreate && value.canEdit ? 'all' : value.canCreate ? 'create' : value.canEdit ? 'edit' : 'read';
  }
  setExecutionProfile(row: ResourceRow, value: string): void {
    if (this.savingAccess()) return;
    if (value === 'none') { this.removeRow(row.key); return; }
    this.draftAccess.update(current => ({ ...current, [row.key]: { ...this.toSaveRequest(row), canRead: true, canCreate: value === 'all' || value === 'create', canEdit: value === 'all' || value === 'edit' } }));
  }
  permission(row: ResourceRow, key: PermissionKey): boolean { return !!this.draftAccess()[row.key]?.[key]; }

  togglePermission(row: ResourceRow, key: PermissionKey, checked: boolean): void {
    this.draftAccess.update(current => {
      const next = { ...current };
      if (key === 'canRead' && !checked) {
        delete next[row.key];
        return next;
      }
      const access = next[row.key] ?? this.toSaveRequest(row);
      next[row.key] = {
        ...access,
        canRead: key === 'canRead' ? checked : true,
        [key]: checked
      };
      return next;
    });
  }

  grantReadToSelected(): void {
    const rows = this.resourceRows().filter(row => this.selectedRowKeys().includes(row.key));
    this.draftAccess.update(current => {
      const next = { ...current };
      for (const row of rows) if (row.environmentEnabled && !next[row.key]) next[row.key] = { ...this.toSaveRequest(row), canRead: true };
      return next;
    });
  }

  removeSelected(): void {
    this.draftAccess.update(current => {
      const next = { ...current };
      for (const key of this.selectedRowKeys()) delete next[key];
      return next;
    });
    this.selectedRowKeys.set([]);
  }

  removeRow(key: string): void {
    this.draftAccess.update(current => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  discardChanges(): void {
    this.draftAccess.set(this.cloneAccess(this.initialAccess()));
    this.selectedRowKeys.set([]);
  }

  saveChanges(): void {
    const userId = this.selectedUserId();
    if (!userId || !this.hasChanges() || this.savingAccess()) return;
    if (!confirmMutation('save', 'API access changes for the selected user')) return;
    this.savingAccess.set(true);
    this.errorMessage.set('');
    const grants = Object.values(this.draftAccess());
    this.security.updateUserApiAccess(userId, { grants }).subscribe({
      next: () => {
        this.savingAccess.set(false);
        this.initialAccess.set(this.cloneAccess(this.draftAccess()));
        this.selectedRowKeys.set([]);
        this.toast.success('API access saved');
        this.loadGrants(userId);
      },
      error: (error: HttpErrorResponse) => {
        this.savingAccess.set(false);
        this.errorMessage.set(readProblem(error, 'Could not save API access.'));
      }
    });
  }

  methodClass(method: string): string { return `method-${method.toLowerCase()}`; }

  private loadGrants(userId: string): void {
    this.loadingGrants.set(true);
    this.errorMessage.set('');
    this.security.getUserApiAccess(userId).subscribe({
      next: grants => {
        const access: Record<string, SaveUserApiAccessGrantRequest> = {};
        for (const grant of grants) access[this.resourceKey(grant.applicationId, grant.apiEndpointId, grant.apiEnvironmentId)] = this.toSaveRequest(grant);
        this.grants.set(grants);
        this.draftAccess.set(access);
        this.initialAccess.set(this.cloneAccess(access));
        this.selectedRowKeys.set([]);
        this.loadingGrants.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loadingGrants.set(false);
        this.errorMessage.set(readProblem(error, 'Could not load API access grants.'));
      }
    });
  }

  private resourceKey(applicationId: string, endpointId: string, environmentId: string): string {
    return `${applicationId}:${endpointId}:${environmentId}`;
  }

  private toSaveRequest(resource: SaveUserApiAccessGrantRequest): SaveUserApiAccessGrantRequest {
    return {
      applicationId: resource.applicationId,
      apiAssetId: resource.apiAssetId,
      apiVersionId: resource.apiVersionId,
      apiEndpointId: resource.apiEndpointId,
      apiEnvironmentId: resource.apiEnvironmentId,
      canRead: resource.canRead,
      canCreate: resource.canCreate,
      canEdit: resource.canEdit
    };
  }

  private cloneAccess(access: Record<string, SaveUserApiAccessGrantRequest>): Record<string, SaveUserApiAccessGrantRequest> {
    return Object.fromEntries(Object.entries(access).map(([key, value]) => [key, { ...value }]));
  }

  private serializeAccess(access: Record<string, SaveUserApiAccessGrantRequest>): string {
    return JSON.stringify(Object.entries(access).sort(([a], [b]) => a.localeCompare(b)));
  }
}
