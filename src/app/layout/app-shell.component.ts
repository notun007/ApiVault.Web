import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { RuntimeConfigService } from '../core/config/runtime-config.service';
import { UserRole } from '../core/models/security.models';
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
  imports: [RouterOutlet, RouterLink, RouterLinkActive, EnumLabelPipe],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss'
})
export class AppShellComponent {
  readonly auth = inject(AuthService);
  readonly runtime = inject(RuntimeConfigService);
  private readonly router = inject(Router);
  readonly mobileSidebarOpen = signal(false);

  private readonly navItems: NavItem[] = [
    { label: 'Dashboard', caption: 'Portfolio overview', path: '/dashboard', icon: 'DB' },
    { label: 'API Catalog', caption: 'Assets and releases', path: '/apis', icon: 'AP' },
    { label: 'Projects', caption: 'Consumer dependencies', path: '/projects', icon: 'PR' },
    { label: 'Test Console', caption: 'Controlled execution', path: '/testing', icon: 'TX', roles: [UserRole.Admin, UserRole.ApiOwner, UserRole.Tester] },
    { label: 'Test History', caption: 'Evidence and results', path: '/test-history', icon: 'HS' },
    { label: 'Reference Data', caption: 'Businesses and teams', path: '/admin/reference-data', icon: 'RF', roles: [UserRole.Admin] },
    { label: 'API Projects', caption: 'API ownership registry', path: '/admin/api-projects', icon: 'PJ', roles: [UserRole.Admin, UserRole.ApiOwner] },
    { label: 'Users', caption: 'Roles and access', path: '/admin/users', icon: 'US', roles: [UserRole.Admin] },
    { label: 'User Access', caption: 'Assign user roles', path: '/admin/security/user-access', icon: 'UA', roles: [UserRole.Admin] },
    { label: 'Roles', caption: 'Security permissions', path: '/admin/security/roles', icon: 'RL', roles: [UserRole.Admin] },
    { label: 'Permissions', caption: 'Screen access rules', path: '/admin/security/permissions', icon: 'PM', roles: [UserRole.Admin] },
    { label: 'Audit Logs', caption: 'Change traceability', path: '/admin/audit', icon: 'AU', roles: [UserRole.Admin] }
  ];

  readonly visibleNav = computed(() => this.navItems.filter((item) => !item.roles || item.roles.some((role) => this.auth.hasAnyRole(role))));
  readonly initials = computed(() => this.auth.displayName().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'AV');

  closeMobileSidebar(): void { this.mobileSidebarOpen.set(false); }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
