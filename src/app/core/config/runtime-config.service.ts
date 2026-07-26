import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface RuntimeConfig {
  apiBaseUrl: string;
  applicationName: string;
  organizationName: string;
  sessionStorageKey: string;
}

const DEFAULT_CONFIG: RuntimeConfig = {
  apiBaseUrl: 'https://localhost:44315',
  applicationName: 'ApiVault',
  organizationName: 'Banking Organization',
  sessionStorageKey: 'apivault.session'
};

@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  private readonly http = inject(HttpClient);
  private readonly configState = signal<RuntimeConfig>(DEFAULT_CONFIG);

  readonly config = this.configState.asReadonly();

  async load(): Promise<void> {
    try {
      const config = await firstValueFrom(this.http.get<Partial<RuntimeConfig>>(`/config/runtime-config.json?v=${Date.now()}`));
      this.configState.set({ ...DEFAULT_CONFIG, ...config });
    } catch {
      this.configState.set(DEFAULT_CONFIG);
    }
  }

  apiUrl(path: string): string {
    const base = this.configState().apiBaseUrl.replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalizedPath}`;
  }
}
