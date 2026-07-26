import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  ApiDetailResponse,
  ApiSearchQuery,
  ApiSummaryResponse,
  ApiVersionResponse,
  CreateApiRequest,
  CreateApiVersionRequest,
  CreateEndpointRequest,
  CreateEnvironmentRequest,
  EndpointResponse,
  EnvironmentResponse,
  LookupResponse,
  PagedResult,
  SetEnvironmentSecretRequest,
  UpdateApiVersionRequest
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ApiCatalogClient {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);

  search(query: ApiSearchQuery = {}) {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    });
    return this.http.get<PagedResult<ApiSummaryResponse>>(this.runtime.apiUrl('/api/apis'), { params });
  }

  get(id: string) {
    return this.http.get<ApiDetailResponse>(this.runtime.apiUrl(`/api/apis/${id}`));
  }

  create(request: CreateApiRequest) {
    return this.http.post<ApiDetailResponse>(this.runtime.apiUrl('/api/apis'), request);
  }

  update(id: string, request: CreateApiRequest) {
    return this.http.put<ApiDetailResponse>(this.runtime.apiUrl(`/api/apis/${id}`), request);
  }

  addVersion(apiId: string, request: CreateApiVersionRequest) {
    return this.http.post<ApiVersionResponse>(this.runtime.apiUrl(`/api/apis/${apiId}/versions`), request);
  }

  getVersion(versionId: string) {
    return this.http.get<ApiVersionResponse>(this.runtime.apiUrl(`/api/apis/versions/${versionId}`));
  }

  updateVersion(apiId: string, versionId: string, request: UpdateApiVersionRequest) {
    return this.http.put<ApiVersionResponse>(this.runtime.apiUrl(`/api/apis/${apiId}/versions/${versionId}`), request);
  }

  changeLifecycle(apiId: string, versionId: string, lifecycleStatus: string) {
    return this.http.patch<ApiVersionResponse>(
      this.runtime.apiUrl(`/api/apis/${apiId}/versions/${versionId}/lifecycle`),
      { lifecycleStatus }
    );
  }

  addEndpoint(apiId: string, versionId: string, request: CreateEndpointRequest) {
    return this.http.post<EndpointResponse>(
      this.runtime.apiUrl(`/api/apis/${apiId}/versions/${versionId}/endpoints`),
      request
    );
  }

  updateEndpoint(apiId: string, versionId: string, endpointId: string, request: CreateEndpointRequest) {
    return this.http.put<EndpointResponse>(
      this.runtime.apiUrl(`/api/apis/${apiId}/versions/${versionId}/endpoints/${endpointId}`),
      request
    );
  }

  addEnvironment(apiId: string, versionId: string, request: CreateEnvironmentRequest) {
    return this.http.post<EnvironmentResponse>(
      this.runtime.apiUrl(`/api/apis/${apiId}/versions/${versionId}/environments`),
      request
    );
  }

  updateEnvironment(apiId: string, versionId: string, environmentId: string, request: CreateEnvironmentRequest) {
    return this.http.put<EnvironmentResponse>(
      this.runtime.apiUrl(`/api/apis/${apiId}/versions/${versionId}/environments/${environmentId}`),
      request
    );
  }

  setEnvironmentSecret(apiId: string, versionId: string, environmentId: string, request: SetEnvironmentSecretRequest) {
    return this.http.put<EnvironmentResponse>(
      this.runtime.apiUrl(`/api/apis/${apiId}/versions/${versionId}/environments/${environmentId}/secret`),
      request
    );
  }

  getOpenApi(apiVersionId: string) {
    return this.http.get<Record<string, unknown>>(
      this.runtime.apiUrl(`/api/catalog-documents/${apiVersionId}/openapi.json`)
    );
  }

  openApiUrl(apiVersionId: string): string {
    return this.runtime.apiUrl(`/api/catalog-documents/${apiVersionId}/openapi.json`);
  }
}
