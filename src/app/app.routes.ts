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
        loadComponent: () => import('./features/apis/api-list.component').then((m) => m.ApiListComponent)
      },
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
        path: 'admin/reference-data',
        canActivate: [roleGuard],
        data: { roles: [UserRole.Admin] },
        loadComponent: () => import('./features/administration/reference-data.component').then((m) => m.ReferenceDataComponent)
      },
      {
        path: 'admin/api-projects',
        canActivate: [roleGuard],
        data: { roles: [UserRole.Admin, UserRole.ApiOwner] },
        loadComponent: () => import('./features/administration/api-projects.component').then((m) => m.ApiProjectsComponent)
      },
      {
        path: 'admin/users',
        canActivate: [roleGuard],
        data: { roles: [UserRole.Admin] },
        loadComponent: () => import('./features/administration/users.component').then((m) => m.UsersComponent)
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
