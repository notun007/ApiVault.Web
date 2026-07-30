import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { readProblem } from '../../core/http/error.interceptor';
import { UserAccessResponse, RoleResponse } from '../../core/models/security.models';
import { AdminClient } from '../../core/services/admin.client';
import { SecurityClient } from '../../core/services/security.client';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-user-access',
  standalone: true,
  imports: [PageHeaderComponent, EmptyStateComponent],
  templateUrl: './user-access.component.html',
  styleUrl: './user-access.component.scss'
})
export class UserAccessComponent {
  private readonly admin = inject(AdminClient);
  private readonly security = inject(SecurityClient);
  private readonly toast = inject(ToastService);

  readonly users = signal<UserAccessResponse[]>([]);
  readonly roles = signal<RoleResponse[]>([]);
  readonly selectedUserId = signal('');
  readonly selectedRoleIds = signal<string[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly errorMessage = signal('');

  constructor() {
    forkJoin({ users: this.admin.getUserAccess(), roles: this.security.getRoles() }).subscribe({
      next: ({ users, roles }) => {
        this.users.set(users);
        this.roles.set(roles);
        this.loading.set(false);
        if (users.length > 0) this.selectUser(users[0].userId);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(readProblem(error, 'Could not load user access data.'));
      }
    });
  }

  selectUser(userId: string): void {
    this.selectedUserId.set(userId);
    const user = this.users().find(item => item.userId === userId);
    this.selectedRoleIds.set(user?.roles.map(role => role.roleId) ?? []);
  }

  isSelected(roleId: string): boolean { return this.selectedRoleIds().includes(roleId); }

  toggleRole(roleId: string): void {
    const selected = new Set(this.selectedRoleIds());
    if (selected.has(roleId)) selected.delete(roleId);
    else selected.add(roleId);
    this.selectedRoleIds.set([...selected]);
  }

  save(): void {
    const userId = this.selectedUserId();
    if (!userId || this.selectedRoleIds().length === 0 || this.saving()) return;
    this.saving.set(true);
    this.admin.updateUserRoles(userId, { roleIds: this.selectedRoleIds() }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('User roles saved');
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.errorMessage.set(readProblem(error, 'Could not save user roles.'));
      }
    });
  }
}
