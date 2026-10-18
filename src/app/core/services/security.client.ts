import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AppConfigService } from '../config/app-config.service';
import {
  CreateRoleRequest,
  ApiAccessCatalogApplicationResponse,
  PermissionResponse,
  RolePermissionResponse,
  RoleResponse,
  SecurityScreenResponse,
  SaveUserApiAccessRequest,
  UserApiAccessGrantResponse,
  UpdateRolePermissionsRequest
} from '../models/security.models';

@Injectable({ providedIn: 'root' })
export class SecurityClient {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(AppConfigService);

  getRoles() { return this.http.get<RoleResponse[]>(this.runtime.apiUrl('/api/security/roles')); }
  createRole(request: CreateRoleRequest) { return this.http.post<RoleResponse>(this.runtime.apiUrl('/api/security/roles'), request); }
  updateRole(id: string, request: CreateRoleRequest) { return this.http.put<RoleResponse>(this.runtime.apiUrl(`/api/security/roles/${id}`), request); }
  getPermissions() { return this.http.get<PermissionResponse[]>(this.runtime.apiUrl('/api/security/permissions')); }
  getScreens() { return this.http.get<SecurityScreenResponse[]>(this.runtime.apiUrl('/api/security/screens')); }
  getRolePermissions(roleId: string) { return this.http.get<RolePermissionResponse[]>(this.runtime.apiUrl(`/api/security/roles/${roleId}/permissions`)); }
  updateRolePermissions(roleId: string, request: UpdateRolePermissionsRequest) { return this.http.put<void>(this.runtime.apiUrl(`/api/security/roles/${roleId}/permissions`), request); }
  getApiAccessCatalog() { return this.http.get<ApiAccessCatalogApplicationResponse[]>(this.runtime.apiUrl('/api/security/api-access/catalog')); }
  getUserApiAccess(userId: string) { return this.http.get<UserApiAccessGrantResponse[]>(this.runtime.apiUrl(`/api/security/users/${userId}/api-access`)); }
  updateUserApiAccess(userId: string, request: SaveUserApiAccessRequest) { return this.http.put<void>(this.runtime.apiUrl(`/api/security/users/${userId}/api-access`), request); }
}
