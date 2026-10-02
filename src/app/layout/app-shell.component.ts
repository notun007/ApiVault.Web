import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { RuntimeConfigService } from '../core/config/runtime-config.service';
import { readProblem } from '../core/http/error.interceptor';
import { UserRole } from '../core/models/security.models';
import { ToastService } from '../core/services/toast.service';
import { ModalComponent } from '../shared/components/modal.component';
import { EnumLabelPipe } from '../shared/pipes/enum-label.pipe';

interface NavItem {
  label: string;
  caption: string;
  path: string;
  icon: string;
  roles?: UserRole[];
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ReactiveFormsModule, ModalComponent, EnumLabelPipe],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss'
})
export class AppShellComponent {
  readonly auth = inject(AuthService);
  readonly runtime = inject(RuntimeConfigService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly mobileSidebarOpen = signal(false);
  readonly passwordModalOpen = signal(false);
  readonly passwordSaving = signal(false);
  readonly passwordError = signal('');
  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required, Validators.maxLength(200)]],
    newPassword: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(200)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(200)]]
  });

  private readonly navItems: NavItem[] = [
    { label: 'Dashboard', caption: 'Portfolio overview', path: '/dashboard', icon: 'DB' },
    { label: 'API Catalog', caption: 'Assets and releases', path: '/apis', icon: 'AP' },
    { label: 'Applications & Systems', caption: 'Publishers and consumers', path: '/projects', icon: 'AS' },
    { label: 'Test Console', caption: 'Controlled execution', path: '/testing', icon: 'TX', roles: [UserRole.Admin, UserRole.ApiOwner, UserRole.Tester] },
    { label: 'Test History', caption: 'Evidence and results', path: '/test-history', icon: 'HS' },
    { label: 'Reference Data', caption: 'Businesses and teams', path: '/admin/reference-data', icon: 'RF', roles: [UserRole.Admin] },
    { label: 'Vendor Companies', caption: 'Third-party registry', path: '/admin/vendors', icon: 'VN', roles: [UserRole.SuperAdmin, UserRole.Admin] },
    { label: 'Users', caption: 'Roles and access', path: '/admin/users', icon: 'US', roles: [UserRole.Admin] },
    { label: 'Reset Password', caption: 'Reset user credentials', path: '/admin/reset-password', icon: 'PW', roles: [UserRole.SuperAdmin, UserRole.Admin] },
    { label: 'User Access', caption: 'Assign user roles', path: '/admin/security/user-access', icon: 'UA', roles: [UserRole.Admin] },
    { label: 'Roles', caption: 'Security permissions', path: '/admin/security/roles', icon: 'RL', roles: [UserRole.Admin] },
    { label: 'Permissions', caption: 'Screen access rules', path: '/admin/security/permissions', icon: 'PM', roles: [UserRole.Admin] },
    { label: 'Audit Logs', caption: 'Change traceability', path: '/admin/audit', icon: 'AU', roles: [UserRole.Admin] }
  ];

  readonly visibleNav = computed(() => this.navItems.filter((item) => !item.roles || item.roles.some((role) => this.auth.hasAnyRole(role))));
  readonly initials = computed(() => this.auth.displayName().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'AV');

  closeMobileSidebar(): void { this.mobileSidebarOpen.set(false); }

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
