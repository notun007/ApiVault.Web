import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  CreateProjectRequest,
  LinkProjectApiVersionRequest,
  ProjectDetailResponse,
  ProjectSummaryResponse
} from '../models/project.models';

@Injectable({ providedIn: 'root' })
export class ProjectClient {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);

  getAll() {
    return this.http.get<ProjectSummaryResponse[]>(this.runtime.apiUrl('/api/projects'));
  }

  get(id: string) {
    return this.http.get<ProjectDetailResponse>(this.runtime.apiUrl(`/api/projects/${id}`));
  }

  create(request: CreateProjectRequest) {
    return this.http.post<ProjectDetailResponse>(this.runtime.apiUrl('/api/projects'), request);
  }

  linkApiVersion(projectId: string, request: LinkProjectApiVersionRequest) {
    return this.http.post<ProjectDetailResponse>(
      this.runtime.apiUrl(`/api/projects/${projectId}/api-versions`),
      request
    );
  }
}
