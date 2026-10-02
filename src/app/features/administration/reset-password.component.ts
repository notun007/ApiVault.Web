import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { readProblem } from '../../core/http/error.interceptor';
import { UserResponse } from '../../core/models/security.models';
import { AdminClient } from '../../core/services/admin.client';
import { ToastService } from '../../core/services/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss'
})
export class ResetPasswordComponent {
  private readonly client = inject(AdminClient);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly users = signal<UserResponse[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly form = this.fb.nonNullable.group({
    userId: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(200)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(200)]]
  });

  constructor() {
    this.client.getUsers().subscribe({
      next: (users) => { this.users.set(users); this.loading.set(false); },
      error: (error: HttpErrorResponse) => { this.loading.set(false); this.errorMessage.set(readProblem(error, 'Could not load users.')); }
    });
  }

  resetPassword(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const { userId, newPassword, confirmPassword } = this.form.getRawValue();
    if (newPassword !== confirmPassword) {
      this.errorMessage.set('The new password and confirmation do not match.');
      return;
    }

    const user = this.users().find((item) => item.id === userId);
    this.saving.set(true);
    this.errorMessage.set('');
    this.client.resetUserPassword(userId, { newPassword, confirmPassword }).subscribe({
      next: () => {
        this.saving.set(false);
        this.form.reset({ userId: '', newPassword: '', confirmPassword: '' });
        this.toast.success(`Password reset for ${user?.username ?? 'user'}`);
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.errorMessage.set(readProblem(error, 'Could not reset the password.'));
      }
    });
  }
}
