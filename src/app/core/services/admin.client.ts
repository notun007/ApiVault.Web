import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../config/runtime-config.service';
import { LookupResponse } from '../models/api.models';
import { CreateLookupRequest, CreateUserRequest, UserResponse } from '../models/security.models';
import { AuditLogResponse } from '../models/test.models';

@Injectable({ providedIn: 'root' })
export class AdminClient {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);

  getBusinessAreas() {
    return this.http.get<LookupResponse[]>(this.runtime.apiUrl('/api/reference-data/business-areas'));
  }

  getDevelopmentTeams() {
    return this.http.get<LookupResponse[]>(this.runtime.apiUrl('/api/reference-data/development-teams'));
  }

  createBusinessArea(request: CreateLookupRequest) {
    return this.http.post<LookupResponse>(this.runtime.apiUrl('/api/reference-data/business-areas'), request);
  }

  createDevelopmentTeam(request: CreateLookupRequest) {
    return this.http.post<LookupResponse>(this.runtime.apiUrl('/api/reference-data/development-teams'), request);
  }

  getUsers() {
    return this.http.get<UserResponse[]>(this.runtime.apiUrl('/api/users'));
  }

  createUser(request: CreateUserRequest) {
    return this.http.post<UserResponse>(this.runtime.apiUrl('/api/users'), request);
  }

  getAuditLogs(entityType?: string, entityId?: string, take = 100) {
    let params = new HttpParams().set('take', take);
    if (entityType) params = params.set('entityType', entityType);
    if (entityId) params = params.set('entityId', entityId);
    return this.http.get<AuditLogResponse[]>(this.runtime.apiUrl('/api/audit-logs'), { params });
  }
}
