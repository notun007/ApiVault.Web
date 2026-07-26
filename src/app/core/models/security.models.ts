export enum UserRole {
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

export interface CreateLookupRequest {
  code: string;
  name: string;
  description?: string | null;
  contactEmail?: string | null;
}
