export enum UserRole {
  SuperAdmin = 'SuperAdmin',
  Admin = 'Admin',
  ApiOwner = 'ApiOwner',
  Tester = 'Tester',
  Viewer = 'Viewer'
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  expiresAtUtc: string;
  displayName: string;
  role: UserRole;
  isSuccess: boolean;
  message?: string | null;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ResetPasswordRequest {
  newPassword: string;
  confirmPassword: string;
}

export interface AuthSession extends LoginResponse {
  username: string;
}

export interface CreateUserRequest {
  username: string;
  displayName: string;
  email?: string | null;
  password: string;
  role: UserRole;
}

export interface UserResponse {
  id: string;
  username: string;
  displayName: string;
  email?: string | null;
  role: UserRole;
  isActive: boolean;
  lastLoginAtUtc?: string | null;
}

export interface UserAccessResponse {
  userId: string;
  username: string;
  displayName: string;
  isActive: boolean;
  roles: UserRoleAssignmentResponse[];
}

export interface UserRoleAssignmentResponse {
  roleId: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface UpdateUserRolesRequest {
  roleIds: string[];
}

export interface RoleResponse {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isSystemRole: boolean;
  isActive: boolean;
  userCount: number;
}

export interface CreateRoleRequest {
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
}

export interface PermissionResponse {
  id: string;
  code: string;
  name: string;
  description?: string | null;
}

export interface SecurityScreenResponse {
  id: string;
  code: string;
  name: string;
  route: string;
  icon?: string | null;
  parentId?: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface RolePermissionResponse {
  screenId: string;
  permissionIds: string[];
}

export interface UpdateRolePermissionsRequest {
  permissions: RolePermissionResponse[];
}

export interface ApiAccessCatalogApplicationResponse {
  id: string;
  code: string;
  name: string;
  apis: ApiAccessCatalogApiResponse[];
}

export interface ApiAccessCatalogApiResponse {
  id: string;
  name: string;
  releases: ApiAccessCatalogReleaseResponse[];
}

export interface ApiAccessCatalogReleaseResponse {
  id: string;
  version: string;
  releaseName?: string | null;
  lifecycleStatus: string;
  endpoints: ApiAccessCatalogEndpointResponse[];
  environments: ApiAccessCatalogEnvironmentResponse[];
}

export interface ApiAccessCatalogEndpointResponse {
  id: string;
  name: string;
  httpMethod: string;
  relativePath: string;
}

export interface ApiAccessCatalogEnvironmentResponse {
  id: string;
  environmentType: string;
  isEnabled: boolean;
}

export interface UserApiAccessGrantResponse {
  id: string;
  userId: string;
  applicationId: string;
  applicationCode: string;
  applicationName: string;
  apiAssetId: string;
  apiName: string;
  apiVersionId: string;
  apiVersion: string;
  apiEndpointId: string;
  endpointName: string;
  httpMethod: string;
  relativePath: string;
  apiEnvironmentId: string;
  environmentType: string;
  canRead: boolean;
  canCreate: boolean;
  canEdit: boolean;
}

export interface SaveUserApiAccessGrantRequest {
  applicationId: string;
  apiAssetId: string;
  apiVersionId: string;
  apiEndpointId: string;
  apiEnvironmentId: string;
  canRead: boolean;
  canCreate: boolean;
  canEdit: boolean;
}

export interface SaveUserApiAccessRequest {
  grants: SaveUserApiAccessGrantRequest[];
}

export interface CreateLookupRequest {
  code: string;
  name: string;
  description?: string | null;
}
