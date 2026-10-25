export type CatalogProfile = 'None' | 'Viewer' | 'Maintainer' | 'Manager';
export interface CatalogAssignment { apiId: string; releaseScopeId: string; profile: CatalogProfile; }
export interface CatalogAccessResponse { assignments: CatalogAssignment[]; hasLegacyAssignments: boolean; }
export const ALL_RELEASES = '00000000-0000-0000-0000-000000000000';
