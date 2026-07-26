import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { readProblem } from '../../core/http/error.interceptor';
import { UserResponse, UserRole } from '../../core/models/security.models';
import { AdminClient } from '../../core/services/admin.client';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, ModalComponent, EmptyStateComponent, EnumLabelPipe],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent {
  private readonly client = inject(AdminClient);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly users = signal<UserResponse[]>([]);
  readonly loading = signal(true);
  readonly modalOpen = signal(false);
  readonly saving = signal(false);
  readonly modalError = signal('');
  readonly roles = Object.values(UserRole);
  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.maxLength(100)]],
    displayName: ['', [Validators.required, Validators.maxLength(200)]],
    email: ['', Validators.email],
    password: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(200)]],
    role: [UserRole.Viewer, Validators.required]
  });
  constructor() { this.load(); }
  load(): void { this.client.getUsers().subscribe({ next: (items) => { this.users.set(items); this.loading.set(false); }, error: () => this.loading.set(false) }); }
  openCreate(): void { this.form.reset({ username: '', displayName: '', email: '', password: '', role: UserRole.Viewer }); this.modalError.set(''); this.modalOpen.set(true); }
  save(): void {
    if (this.form.invalid || this.saving()) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue(); this.saving.set(true);
    this.client.createUser({ ...value, email: value.email || null }).subscribe({
      next: () => { this.saving.set(false); this.modalOpen.set(false); this.toast.success('User created'); this.load(); },
      error: (error: HttpErrorResponse) => { this.saving.set(false); this.modalError.set(readProblem(error)); }
    });
  }
  formatDate(value: string): string { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
}
