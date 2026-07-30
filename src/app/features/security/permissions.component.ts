import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { readProblem } from '../../core/http/error.interceptor';
import { PermissionResponse, RoleResponse, SecurityScreenResponse } from '../../core/models/security.models';
import { SecurityClient } from '../../core/services/security.client';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-security-permissions',
  standalone: true,
  imports: [PageHeaderComponent, EmptyStateComponent],
  templateUrl: './permissions.component.html',
  styleUrl: './permissions.component.scss'
})
export class PermissionsComponent {
  private readonly client = inject(SecurityClient);
  private readonly toast = inject(ToastService);

  readonly roles = signal<RoleResponse[]>([]);
  readonly screens = signal<SecurityScreenResponse[]>([]);
  readonly permissions = signal<PermissionResponse[]>([]);
  readonly selectedRoleId = signal('');
  readonly assignments = signal<Record<string, string[]>>({});
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly errorMessage = signal('');

  constructor() {
    forkJoin({ roles: this.client.getRoles(), screens: this.client.getScreens(), permissions: this.client.getPermissions() }).subscribe({
      next: ({ roles, screens, permissions }) => {
        this.roles.set(roles);
        this.screens.set(screens);
        this.permissions.set(permissions);
        this.loading.set(false);
        if (roles.length > 0) {
          this.selectedRoleId.set(roles[0].id);
          this.loadAssignments(roles[0].id);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(readProblem(error, 'Could not load security screens and permissions.'));
      }
    });
  }

  selectRole(event: Event): void {
    const roleId = (event.target as HTMLSelectElement).value;
    this.selectedRoleId.set(roleId);
    this.loadAssignments(roleId);
  }

  isSelected(screenId: string, permissionId: string): boolean {
    return this.assignments()[screenId]?.includes(permissionId) ?? false;
  }

  toggle(screenId: string, permissionId: string): void {
    const current = this.assignments();
    const selected = new Set(current[screenId] ?? []);
    if (selected.has(permissionId)) selected.delete(permissionId);
    else selected.add(permissionId);
    this.assignments.set({ ...current, [screenId]: [...selected] });
  }

  save(): void {
    const roleId = this.selectedRoleId();
    if (!roleId || this.saving()) return;
    this.saving.set(true);
    const permissions = Object.entries(this.assignments()).map(([screenId, permissionIds]) => ({ screenId, permissionIds }));
    this.client.updateRolePermissions(roleId, { permissions }).subscribe({
      next: () => { this.saving.set(false); this.toast.success('Role permissions saved'); },
      error: (error: HttpErrorResponse) => { this.saving.set(false); this.errorMessage.set(readProblem(error)); }
    });
  }

  private loadAssignments(roleId: string): void {
    if (!roleId) { this.assignments.set({}); return; }
    this.client.getRolePermissions(roleId).subscribe({
      next: (items) => this.assignments.set(Object.fromEntries(items.map((item) => [item.screenId, item.permissionIds]))),
      error: (error: HttpErrorResponse) => this.errorMessage.set(readProblem(error, 'Could not load role permissions.'))
    });
  }
}
