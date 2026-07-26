import { ApiLifecycleStatus } from './api.models';

export enum ProjectStatus {
  Active = 'Active',
  Inactive = 'Inactive',
  Retired = 'Retired'
}

export enum ProjectCriticality {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Critical = 'Critical'
}

export interface CreateProjectRequest {
  code: string;
  name: string;
  description?: string | null;
  criticality: ProjectCriticality;
  status: ProjectStatus;
  businessAreaId: string;
  ownerTeamId: string;
}

export interface LinkProjectApiVersionRequest {
  apiVersionId: string;
  purpose?: string | null;
  isRequired: boolean;
}

export interface ProjectSummaryResponse {
  id: string;
  code: string;
  name: string;
  criticality: ProjectCriticality;
  status: ProjectStatus;
  businessArea: string;
  ownerTeam: string;
  linkedApiVersionCount: number;
}

export interface ProjectApiLinkResponse {
  linkId: string;
  apiId: string;
  apiName: string;
  apiVersionId: string;
  version: string;
  lifecycleStatus: ApiLifecycleStatus;
  purpose?: string | null;
  isRequired: boolean;
}

export interface ProjectDetailResponse extends ProjectSummaryResponse {
  description?: string | null;
  apiVersions: ProjectApiLinkResponse[];
}
