import { ALL_RELEASES, CatalogAssignment } from '../models/catalog-access.models';
import { HttpClient } from '@angular/common/http';
import { effect, inject, Injectable, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { AppConfigService } from '../config/app-config.service';
import { UserRole } from '../models/security.models';

export interface CatalogPermissionGrant {
  applicationId: string; apiId: string; versionId: string; endpointId: string; environmentId: string;
  canCreate: boolean; canEdit: boolean;
}
interface CatalogPermissions { isUnrestricted: boolean; grants: CatalogPermissionGrant[]; profiles?: (CatalogAssignment & { applicationId: string })[]; }

@Injectable({ providedIn: 'root' })
export class CatalogPermissionsService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
  private readonly auth = inject(AuthService);
  private readonly state = signal<CatalogPermissions>({ isUnrestricted: false, grants: [] });
  private request?: Subscription;
  readonly loading = signal(false);

  constructor() { effect(() => { this.auth.token(); this.load(); }); }

  load(): void {
    this.request?.unsubscribe();
    this.state.set({ isUnrestricted: false, grants: [] });
    this.loading.set(false);
    const token = this.auth.token();
    if (!token || this.auth.hasAnyRole(UserRole.Admin)) return;
    this.loading.set(true);
    this.request = this.http.get<CatalogPermissions>(this.config.apiUrl('/api/apis/permissions')).subscribe({
      next: permissions => { if (this.auth.token() === token) { this.state.set(permissions); this.loading.set(false); } },
      error: () => { if (this.auth.token() === token) this.loading.set(false); }
    });
  }

  private canAuthor(): boolean { return this.auth.hasAnyRole(UserRole.Admin, UserRole.ApiOwner); }
  private unrestricted(): boolean { return this.auth.hasAnyRole(UserRole.Admin) || this.state().isUnrestricted; }
  private profileWrites(apiId: string, versionId?: string): boolean | undefined {
    const profiles = this.state().profiles?.filter(p => p.apiId === apiId) ?? [];
    if (!profiles.length) return undefined;
    return profiles.some(p => ['Maintainer', 'Manager'].includes(p.profile) && (p.releaseScopeId === ALL_RELEASES || !!versionId && p.releaseScopeId === versionId));
  }
  canRegisterApi(applicationId?: string): boolean {
    if (!this.canAuthor()) return false;
    if (this.unrestricted()) return true;
    const profiles = this.state().profiles ?? [];
    return profiles.some(p => ['Maintainer', 'Manager'].includes(p.profile) && p.releaseScopeId === ALL_RELEASES && (!applicationId || p.applicationId === applicationId)) ||
      this.state().grants.some(g => g.canCreate && !profiles.some(p => p.apiId === g.apiId) && (!applicationId || g.applicationId === applicationId));
  }
  canCreate(apiId: string, versionId?: string): boolean {
    if (!this.canAuthor()) return false;
    if (this.unrestricted()) return true;
    return this.profileWrites(apiId, versionId) ?? this.state().grants.some(g => g.canCreate && g.apiId === apiId && (!versionId || g.versionId === versionId));
  }
  canEdit(apiId: string, versionId?: string, endpointId?: string, environmentId?: string): boolean {
    if (!this.canAuthor()) return false;
    if (this.unrestricted()) return true;
    return this.profileWrites(apiId, versionId) ?? this.state().grants.some(g => g.canEdit && g.apiId === apiId && (!versionId || g.versionId === versionId) && (!endpointId || g.endpointId === endpointId) && (!environmentId || g.environmentId === environmentId));
  }
  canManageAny(): boolean {
    if (!this.canAuthor()) return false;
    if (this.unrestricted()) return true;
    const profiles = this.state().profiles ?? [];
    return profiles.some(p => ['Maintainer', 'Manager'].includes(p.profile)) || this.state().grants.some(g => (g.canCreate || g.canEdit) && !profiles.some(p => p.apiId === g.apiId));
  }
  canDelete(apiId: string): boolean {
    return this.canAuthor() && (this.unrestricted() || (this.state().profiles ?? []).some(p => p.apiId === apiId && p.releaseScopeId === ALL_RELEASES && p.profile === 'Manager'));
  }

  canExecute(endpointId: string, environmentId: string, method: string): boolean {
    if (!this.auth.hasAnyRole(UserRole.Admin, UserRole.ApiOwner, UserRole.Tester)) return false;
    if (this.auth.hasAnyRole(UserRole.Admin) || this.state().isUnrestricted) return true;
    return this.state().grants.some(grant => grant.endpointId === endpointId && grant.environmentId === environmentId && (
      ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) ||
      (method.toUpperCase() === 'POST' && grant.canCreate) ||
      (['PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) && grant.canEdit)));
  }
}
