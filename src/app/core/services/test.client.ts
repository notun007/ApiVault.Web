import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../config/runtime-config.service';
import { ExecuteApiTestRequest, TestExecutionResponse } from '../models/test.models';

@Injectable({ providedIn: 'root' })
export class TestClient {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);

  execute(request: ExecuteApiTestRequest) {
    return this.http.post<TestExecutionResponse>(this.runtime.apiUrl('/api/api-tests/execute'), request);
  }

  history(endpointId?: string, environmentId?: string, take = 50) {
    let params = new HttpParams().set('take', take);
    if (endpointId) params = params.set('endpointId', endpointId);
    if (environmentId) params = params.set('environmentId', environmentId);
    return this.http.get<TestExecutionResponse[]>(this.runtime.apiUrl('/api/api-tests/history'), { params });
  }
}
