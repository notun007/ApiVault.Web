import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
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
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly sortBy = signal('screen');
  readonly sortDescending = signal(false);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly totalPages = computed(() => Math.ceil(this.screens().length / this.pageSize()));
  readonly sortedScreens = computed(() => [...this.screens()].sort((left, right) => {
    const field = this.sortBy();
    let comparison: number;
    if (field === 'route') {
      comparison = left.route.localeCompare(right.route);
    } else if (field.startsWith('permission:')) {
      const permissionId = field.slice('permission:'.length);
      comparison = Number(this.isSelected(left.id, permissionId)) - Number(this.isSelected(right.id, permissionId));
    } else {
      comparison = left.name.localeCompare(right.name);
    }

    if (comparison === 0) comparison = left.name.localeCompare(right.name);
    return this.sortDescending() ? -comparison : comparison;
  }));
  readonly visibleScreens = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.sortedScreens().slice(start, start + this.pageSize());
  });
  readonly firstVisibleRecord = computed(() => this.screens().length === 0 ? 0 : ((this.page() - 1) * this.pageSize()) + 1);
  readonly lastVisibleRecord = computed(() => Math.min(this.page() * this.pageSize(), this.screens().length));

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
    this.page.set(1);
    this.loadAssignments(roleId);
  }

  changePage(page: number): void {
    this.page.set(Math.min(Math.max(1, page), Math.max(1, this.totalPages())));
  }

  changePageSize(event: Event): void {
    this.pageSize.set(Number((event.target as HTMLSelectElement).value));
    this.page.set(1);
  }

  changeSort(field: string): void {
    if (this.sortBy() === field) {
      this.sortDescending.update((descending) => !descending);
    } else {
      this.sortBy.set(field);
      this.sortDescending.set(false);
    }
    this.page.set(1);
  }

  sortAria(field: string): 'ascending' | 'descending' | 'none' {
    if (this.sortBy() !== field) return 'none';
    return this.sortDescending() ? 'descending' : 'ascending';
  }

  permissionSortKey(permissionId: string): string {
    return `permission:${permissionId}`;
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
