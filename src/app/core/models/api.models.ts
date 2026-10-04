export enum ApiOwnershipType {
  Internal = 'Internal',
  ThirdParty = 'ThirdParty'
}

export enum ApiProtocol {
  Rest = 'Rest',
  Soap = 'Soap',
  WebService = 'WebService'
}

export enum ApiLifecycleStatus {
  Draft = 'Draft',
  Active = 'Active',
  Deprecated = 'Deprecated',
  Retired = 'Retired'
}

export enum AuthenticationType {
  None = 'None',
  Bearer = 'Bearer',
  Basic = 'Basic',
  ApiKey = 'ApiKey',
  OAuth2 = 'OAuth2',
  MutualTls = 'MutualTls',
  Custom = 'Custom'
}

export enum DeploymentEnvironment {
  Development = 'Development',
  Uat = 'Uat',
  Production = 'Production',
  DisasterRecovery = 'DisasterRecovery',
  Sandbox = 'Sandbox'
}

export interface LookupResponse {
  id: string;
  code: string;
  name: string;
}

export interface VendorResponse {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  contactPerson?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  websiteUrl?: string | null;
  isActive: boolean;
  systemCount: number;
}

export interface SaveVendorRequest {
  code: string;
  name: string;
  description?: string | null;
  contactPerson?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  websiteUrl?: string | null;
  isActive: boolean;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export type ApiCatalogSortField = 'Name' | 'Ownership' | 'Protocol' | 'Business' | 'CurrentRelease' | 'Versions';

export interface ApiSearchQuery {
  search?: string;
  ownershipType?: ApiOwnershipType | '';
  protocol?: ApiProtocol | '';
  lifecycleStatus?: ApiLifecycleStatus | '';
  businessAreaId?: string;
  developmentTeamId?: string;
  publishingApplicationId?: string;
  sortBy?: ApiCatalogSortField;
  sortDescending?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CreateApiRequest {
  name: string;
  publishingApplicationId: string;
  description?: string | null;
  protocol: ApiProtocol;
  externalReferenceUrl?: string | null;
}

export interface ApiSummaryResponse {
  id: string;
  name: string;
  publishingApplicationId: string;
  publishingApplication: LookupResponse;
  ownershipType: ApiOwnershipType;
  protocol: ApiProtocol;
  businessArea: string;
  developmentTeam: string;
  currentVersion?: string | null;
  currentLifecycleStatus?: ApiLifecycleStatus | null;
  versionCount: number;
}

export interface ApiDetailResponse {
  id: string;
  name: string;
  publishingApplicationId: string;
  publishingApplication: LookupResponse;
  description?: string | null;
  ownershipType: ApiOwnershipType;
  protocol: ApiProtocol;
  creatorName: string;
  creatorEmail?: string | null;
  vendorName?: string | null;
  externalReferenceUrl?: string | null;
  businessArea: LookupResponse;
  developmentTeam: LookupResponse;
  versions: ApiVersionResponse[];
}

export interface CreateApiVersionRequest {
  version: string;
  releaseName?: string | null;
  lifecycleStatus: ApiLifecycleStatus;
  releaseDateUtc?: string | null;
  changeLog?: string | null;
  authenticationType: AuthenticationType;
  authenticationInstructions?: string | null;
  authenticationConfigJson?: string | null;
  maxRequestBytes: number;
  maxResponseBytes: number;
  timeoutSeconds: number;
  isCurrent: boolean;
}

export type UpdateApiVersionRequest = Omit<CreateApiVersionRequest, 'version' | 'lifecycleStatus'>;

export interface ApiVersionResponse {
  id: string;
  version: string;
  releaseName?: string | null;
  lifecycleStatus: ApiLifecycleStatus;
  releaseDateUtc?: string | null;
  deprecatedAtUtc?: string | null;
  retiredAtUtc?: string | null;
  changeLog?: string | null;
  authenticationType: AuthenticationType;
  authenticationInstructions?: string | null;
  authenticationConfigJson?: string | null;
  maxRequestBytes: number;
  maxResponseBytes: number;
  timeoutSeconds: number;
  isCurrent: boolean;
  consumers: ApiVersionConsumerResponse[];
  endpoints: EndpointResponse[];
  environments: EnvironmentResponse[];
  openApiDocumentUrl: string;
}

export interface ApiVersionConsumerResponse {
  linkId: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  purpose?: string | null;
  isRequired: boolean;
}

export interface CreateEndpointRequest {
  name: string;
  relativePath: string;
  httpMethod: string;
  description?: string | null;
  requestHeadersJson?: string | null;
  queryParametersJson?: string | null;
  pathParametersJson?: string | null;
  requestPayloadSample?: string | null;
  responseHeadersSampleJson?: string | null;
  responseBodySample?: string | null;
  successStatusCodesJson?: string | null;
  soapAction?: string | null;
}

export interface EndpointResponse extends CreateEndpointRequest {
  id: string;
}

export interface CreateEnvironmentRequest {
  environmentType: DeploymentEnvironment;
  baseUrl: string;
  isEnabled: boolean;
  notes?: string | null;
}

export interface EnvironmentResponse extends CreateEnvironmentRequest {
  id: string;
  secretNames: string[];
}

export interface SetEnvironmentSecretRequest {
  name: string;
  value: string;
}
