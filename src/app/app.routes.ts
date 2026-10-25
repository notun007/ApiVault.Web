import { Routes } from '@angular/router';
import { anonymousGuard, authGuard, roleGuard } from './core/auth/auth.guard';
import { UserRole } from './core/models/security.models';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [anonymousGuard],
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent)
      },
      {
        path: 'apis',
        canActivate: [roleGuard], data: { roles: [UserRole.Admin, UserRole.ApiOwner] },
        loadComponent: () => import('./features/apis/api-list.component').then((m) => m.ApiListComponent)
      },
      { path: 'api-explorer', data: { viewer: true }, loadComponent: () => import('./features/apis/api-list.component').then(m => m.ApiListComponent) },
      { path: 'api-explorer/:apiId/versions/:versionId/reference', data: { viewer: true }, loadComponent: () => import('./features/reference/scalar-reference.component').then(m => m.ScalarReferenceComponent) },
      { path: 'api-explorer/:id', data: { viewer: true }, loadComponent: () => import('./features/apis/api-detail.component').then(m => m.ApiDetailComponent) },
      {
        path: 'apis/new',
        canActivate: [roleGuard],
        data: { roles: [UserRole.Admin, UserRole.ApiOwner] },
        loadComponent: () => import('./features/apis/api-form.component').then((m) => m.ApiFormComponent)
      },
      {
        path: 'apis/:id/edit',
        canActivate: [roleGuard],
        data: { roles: [UserRole.Admin, UserRole.ApiOwner] },
        loadComponent: () => import('./features/apis/api-form.component').then((m) => m.ApiFormComponent)
      },
      {
        path: 'apis/:id/compare',
        loadComponent: () => import('./features/apis/api-version-compare.component').then((m) => m.ApiVersionCompareComponent)
      },
      {
        path: 'apis/:id',
        loadComponent: () => import('./features/apis/api-detail.component').then((m) => m.ApiDetailComponent)
      },
      {
        path: 'apis/:apiId/versions/:versionId/reference',
        loadComponent: () => import('./features/reference/scalar-reference.component').then((m) => m.ScalarReferenceComponent)
      },
      {
        path: 'projects',
        loadComponent: () => import('./features/projects/project-list.component').then((m) => m.ProjectListComponent)
      },
      {
        path: 'projects/:id',
        loadComponent: () => import('./features/projects/project-detail.component').then((m) => m.ProjectDetailComponent)
      },
      {
        path: 'testing',
        canActivate: [roleGuard],
        data: { roles: [UserRole.Admin, UserRole.ApiOwner, UserRole.Tester] },
        loadComponent: () => import('./features/testing/test-console.component').then((m) => m.TestConsoleComponent)
      },
      {
        path: 'test-history',
        loadComponent: () => import('./features/testing/test-history.component').then((m) => m.TestHistoryComponent)
      },
      {
        path: 'admin/navigation',
        canActivate: [roleGuard],
        data: {roles: [UserRole.Admin, UserRole.SuperAdmin]},
        loadComponent: () => import('./features/navigation/menu-management.component').then(m => m.MenuManagementComponent)
      },
      {
        path: 'admin/reference-data',
        redirectTo: 'admin/business-areas',
        pathMatch: 'full'
      },
      {
        path: 'admin/business-areas',
        canActivate: [roleGuard],
        data: { roles: [UserRole.Admin] },
        loadComponent: () => import('./features/administration/business-areas.component').then((m) => m.BusinessAreasComponent)
      },
      {
        path: 'admin/users',
        canActivate: [roleGuard],
        data: { roles: [UserRole.Admin] },
        loadComponent: () => import('./features/administration/users.component').then((m) => m.UsersComponent)
      },
      {
        path: 'admin/vendors',
        canActivate: [roleGuard],
        data: { roles: [UserRole.SuperAdmin, UserRole.Admin] },
        loadComponent: () => import('./features/administration/vendors.component').then((m) => m.VendorsComponent)
      },
      {
        path: 'admin/reset-password',
        canActivate: [roleGuard],
        data: { roles: [UserRole.SuperAdmin, UserRole.Admin] },
        loadComponent: () => import('./features/administration/reset-password.component').then((m) => m.ResetPasswordComponent)
      },
      {
        path: 'admin/security/user-access',
        canActivate: [roleGuard],
        data: { roles: [UserRole.Admin] },
        loadComponent: () => import('./features/security/user-access.component').then((m) => m.UserAccessComponent)
      },
      {
        path: 'admin/security/api-access',
        canActivate: [roleGuard],
        data: { roles: [UserRole.Admin] },
        loadComponent: () => import('./features/security/catalog-access.component').then(m => m.CatalogAccessComponent)
      },
      { path: 'admin/security/api-execution-access', canActivate: [roleGuard], data: { roles: [UserRole.Admin] }, loadComponent: () => import('./features/security/api-access.component').then(m => m.ApiAccessComponent) },
      {
        path: 'admin/security/roles',
        canActivate: [roleGuard],
        data: { roles: [UserRole.Admin] },
        loadComponent: () => import('./features/security/roles.component').then((m) => m.RolesComponent)
      },
      {
        path: 'admin/security/permissions',
        canActivate: [roleGuard],
        data: { roles: [UserRole.Admin] },
        loadComponent: () => import('./features/security/permissions.component').then((m) => m.PermissionsComponent)
      },
      {
        path: 'admin/audit',
        canActivate: [roleGuard],
        data: { roles: [UserRole.Admin] },
        loadComponent: () => import('./features/administration/audit-logs.component').then((m) => m.AuditLogsComponent)
      },
      {
        path: '**',
        loadComponent: () => import('./features/dashboard/not-found.component').then((m) => m.NotFoundComponent)
      }
    ]
  }
];
