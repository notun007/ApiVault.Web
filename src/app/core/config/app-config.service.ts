import { Injectable } from '@angular/core';

export interface AppConfig {
  apiBaseUrl: string;
  applicationName: string;
  organizationName: string;
  sessionStorageKey: string;
}

// Change this URL before building for a different API host.
const APP_CONFIG: AppConfig = {
  apiBaseUrl: 'https://localhost:44315',
  //apiBaseUrl: 'http://172.17.1.227:8025', 
  applicationName: 'ApiVault',
  organizationName: 'Banking Organization',
  sessionStorageKey: 'apivault.session'
};

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  readonly config = () => APP_CONFIG;

  apiUrl(path: string): string {
    const base = APP_CONFIG.apiBaseUrl.replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalizedPath}`;
  }
}
