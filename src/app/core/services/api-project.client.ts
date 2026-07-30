import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../config/runtime-config.service';
import { ApiProjectResponse, CreateApiProjectRequest } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ApiProjectClient {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);

  getAll(activeOnly = false) {
    return this.http.get<ApiProjectResponse[]>(this.runtime.apiUrl('/api/api-projects'), { params: { activeOnly } });
  }

  getActive() {
    return this.http.get<ApiProjectResponse[]>(this.runtime.apiUrl('/api/api-projects/active'));
  }

  create(request: CreateApiProjectRequest) {
    return this.http.post<ApiProjectResponse>(this.runtime.apiUrl('/api/api-projects'), request);
  }

  update(id: string, request: CreateApiProjectRequest) {
    return this.http.put<ApiProjectResponse>(this.runtime.apiUrl(`/api/api-projects/${id}`), request);
  }

  deactivate(id: string) {
    return this.http.patch<void>(this.runtime.apiUrl(`/api/api-projects/${id}/deactivate`), {});
  }
}
