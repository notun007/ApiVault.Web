import { confirmMutation } from '../shared/confirm-mutation';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { AppConfigService } from '../core/config/app-config.service';
import { readProblem } from '../core/http/error.interceptor';
import { UserRole } from '../core/models/security.models';
import { ToastService } from '../core/services/toast.service';
import { ModalComponent } from '../shared/components/modal.component';
import { NavigationService } from '../core/services/navigation.service';
import { NavigationTreeComponent } from '../shared/components/navigation-tree.component';
import { EnumLabelPipe } from '../shared/pipes/enum-label.pipe';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, ReactiveFormsModule, ModalComponent, EnumLabelPipe, NavigationTreeComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss'
})
export class AppShellComponent {
  readonly auth = inject(AuthService);
  readonly runtime = inject(AppConfigService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly mobileSidebarOpen = signal(false);
  readonly sidebarCollapsed = signal(false);
  readonly passwordModalOpen = signal(false);
  readonly passwordSaving = signal(false);
  readonly passwordError = signal('');
  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required, Validators.maxLength(200)]],
    newPassword: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(200)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(200)]]
  });

  readonly navigation = inject(NavigationService);
  readonly UserRole = UserRole;
  constructor() { this.navigation.load(); }

  readonly initials = computed(() => this.auth.displayName().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'AV');

  closeMobileSidebar(): void { this.mobileSidebarOpen.set(false); }
  toggleSidebar(): void { this.sidebarCollapsed.update((collapsed) => !collapsed); }

  openPasswordModal(): void {
    this.passwordForm.reset();
    this.passwordError.set('');
    this.passwordModalOpen.set(true);
  }

  changePassword(): void {
    if (this.passwordForm.invalid || this.passwordSaving()) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const request = this.passwordForm.getRawValue();
    if (request.newPassword !== request.confirmPassword) {
      this.passwordError.set('The new password and confirmation do not match.');
      return;
    }
    if (!confirmMutation('change', 'your password')) return;
    this.passwordSaving.set(true);
    this.auth.changePassword(request).subscribe({
      next: () => {
        this.passwordSaving.set(false);
        this.passwordModalOpen.set(false);
        this.toast.success('Password changed. Please sign in again.');
        this.logout();
      },
      error: (error: HttpErrorResponse) => {
        this.passwordSaving.set(false);
        this.passwordError.set(readProblem(error, 'Could not change the password.'));
      }
    });
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
