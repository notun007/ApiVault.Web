import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { readProblem } from '../../core/http/error.interceptor';
import { CreateRoleRequest, RoleResponse } from '../../core/models/security.models';
import { SecurityClient } from '../../core/services/security.client';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

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
  readonly loading = signal(true);
  readonly modalOpen = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly editing = signal<RoleResponse | null>(null);
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
      next: (items) => { this.roles.set(items); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
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
