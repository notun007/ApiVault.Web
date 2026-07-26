export interface ExecuteApiTestRequest {
  apiEndpointId: string;
  apiEnvironmentId: string;
  pathParameters: Record<string, string>;
  queryParameters: Record<string, string>;
  headers: Record<string, string>;
  body?: string | null;
  timeoutSeconds?: number | null;
}

export interface TestExecutionResponse {
  id: string;
  apiEndpointId: string;
  apiEnvironmentId: string;
  startedAtUtc: string;
  durationMilliseconds: number;
  isSuccess: boolean;
  responseStatusCode?: number | null;
  requestUrl: string;
  requestHeadersJson?: string | null;
  requestBody?: string | null;
  requestSizeBytes: number;
  responseHeadersJson?: string | null;
  responseBody?: string | null;
  responseSizeBytes: number;
  errorMessage?: string | null;
  requestedBy: string;
}

export interface AuditLogResponse {
  id: string;
  occurredAtUtc: string;
  userName: string;
  ipAddress?: string | null;
  correlationId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  changesJson?: string | null;
}
