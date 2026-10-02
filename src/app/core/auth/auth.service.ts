import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { RuntimeConfigService } from '../config/runtime-config.service';
import { AuthSession, ChangePasswordRequest, LoginRequest, LoginResponse, UserRole } from '../models/security.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);
  private readonly sessionState = signal<AuthSession | null>(null);

  readonly session = this.sessionState.asReadonly();
  readonly isAuthenticated = computed(() => {
    const session = this.sessionState();
    return !!session && new Date(session.expiresAtUtc).getTime() > Date.now();
  });
  readonly displayName = computed(() => this.sessionState()?.displayName ?? '');
  readonly role = computed(() => this.sessionState()?.role ?? null);

  constructor() {
    this.restoreSession();
  }

  login(request: LoginRequest) {
    return this.http.post<LoginResponse>(this.runtime.apiUrl('/api/auth/login'), request).pipe(
      tap((response) => {
        const session: AuthSession = { ...response, username: request.username };
        this.sessionState.set(session);
        sessionStorage.setItem(this.storageKey(), JSON.stringify(session));
      })
    );
  }

  changePassword(request: ChangePasswordRequest) {
    return this.http.put<void>(this.runtime.apiUrl('/api/auth/password'), request);
  }

  logout(): void {
    this.sessionState.set(null);
    sessionStorage.removeItem(this.storageKey());
  }

  token(): string | null {
    return this.isAuthenticated() ? this.sessionState()?.accessToken ?? null : null;
  }

  hasAnyRole(...roles: UserRole[]): boolean {
    const role = this.role();
    return role !== null && roles.includes(role);
  }

  private restoreSession(): void {
    const raw = sessionStorage.getItem(this.storageKey());
    if (!raw) return;
    try {
      const session = JSON.parse(raw) as AuthSession;
      if (new Date(session.expiresAtUtc).getTime() > Date.now()) {
        this.sessionState.set(session);
      } else {
        sessionStorage.removeItem(this.storageKey());
      }
    } catch {
      sessionStorage.removeItem(this.storageKey());
    }
  }

  private storageKey(): string {
    return this.runtime.config().sessionStorageKey || 'apivault.session';
  }
}
