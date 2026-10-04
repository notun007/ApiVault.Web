import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { readProblem } from '../../core/http/error.interceptor';
import { CreateRoleRequest, RoleResponse } from '../../core/models/security.models';
import { SecurityClient } from '../../core/services/security.client';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

type RoleSortField = 'Name' | 'Code' | 'Description' | 'Users' | 'Status';

@Component({
  selector: 'app-security-roles',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, ModalComponent, EmptyStateComponent],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.scss'
})
export class RolesComponent {
  private readonly client = inject(SecurityClient);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly roles = signal<RoleResponse[]>([]);
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly sortBy = signal<RoleSortField>('Name');
  readonly sortDescending = signal(false);
  readonly loading = signal(true);
  readonly modalOpen = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly editing = signal<RoleResponse | null>(null);
  readonly totalPages = computed(() => Math.ceil(this.roles().length / this.pageSize()));
  readonly sortedRoles = computed(() => [...this.roles()].sort((left, right) => {
    let comparison: number;
    switch (this.sortBy()) {
      case 'Code':
        comparison = left.code.localeCompare(right.code);
        break;
      case 'Description':
        comparison = (left.description ?? '').localeCompare(right.description ?? '');
        break;
      case 'Users':
        comparison = left.userCount - right.userCount;
        break;
      case 'Status':
        comparison = Number(left.isActive) - Number(right.isActive);
        break;
      default:
        comparison = left.name.localeCompare(right.name);
    }

    if (comparison === 0) comparison = left.name.localeCompare(right.name);
    return this.sortDescending() ? -comparison : comparison;
  }));
  readonly visibleRoles = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.sortedRoles().slice(start, start + this.pageSize());
  });
  readonly firstVisibleRecord = computed(() => this.roles().length === 0 ? 0 : ((this.page() - 1) * this.pageSize()) + 1);
  readonly lastVisibleRecord = computed(() => Math.min(this.page() * this.pageSize(), this.roles().length));
  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(100)]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', Validators.maxLength(4000)],
    isActive: [true]
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.client.getRoles().subscribe({
      next: (items) => {
        this.roles.set(items);
        this.page.update((page) => Math.min(page, Math.max(1, Math.ceil(items.length / this.pageSize()))));
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  changePage(page: number): void {
    this.page.set(Math.min(Math.max(1, page), Math.max(1, this.totalPages())));
  }

  changePageSize(event: Event): void {
    this.pageSize.set(Number((event.target as HTMLSelectElement).value));
    this.page.set(1);
  }

  changeSort(field: RoleSortField): void {
    if (this.sortBy() === field) {
      this.sortDescending.update((descending) => !descending);
    } else {
      this.sortBy.set(field);
      this.sortDescending.set(false);
    }
    this.page.set(1);
  }

  sortAria(field: RoleSortField): 'ascending' | 'descending' | 'none' {
    if (this.sortBy() !== field) return 'none';
    return this.sortDescending() ? 'descending' : 'ascending';
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.reset({ code: '', name: '', description: '', isActive: true });
    this.errorMessage.set('');
    this.modalOpen.set(true);
  }

  openEdit(role: RoleResponse): void {
    this.editing.set(role);
    this.form.reset({ code: role.code, name: role.name, description: role.description ?? '', isActive: role.isActive });
    this.errorMessage.set('');
    this.modalOpen.set(true);
  }

  save(): void {
    if (this.form.invalid || this.saving()) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    const request: CreateRoleRequest = { ...value, description: value.description || null };
    const current = this.editing();
    this.saving.set(true);
    const operation = current ? this.client.updateRole(current.id, request) : this.client.createRole(request);
    operation.subscribe({
      next: () => { this.saving.set(false); this.modalOpen.set(false); this.toast.success(current ? 'Role updated' : 'Role created'); this.load(); },
      error: (error: HttpErrorResponse) => { this.saving.set(false); this.errorMessage.set(readProblem(error)); }
    });
  }
}
