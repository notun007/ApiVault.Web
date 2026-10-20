import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { AppConfigService } from '../config/app-config.service';
import { readProblem } from '../http/error.interceptor';
import { NavigationLayout } from '../models/navigation.models';

@Injectable({providedIn: 'root'})
export class NavigationService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
  readonly items = signal<NavigationLayout['items']>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  load(): void {
    this.items.set([]); this.loading.set(true); this.error.set('');
    this.http.get<NavigationLayout>(this.config.apiUrl('/api/navigation')).subscribe({
      next: layout => { this.items.set(layout.items); this.loading.set(false); },
      error: (error: HttpErrorResponse) => { this.error.set(readProblem(error, 'Could not load navigation.')); this.loading.set(false); }
    });
  }
  initialize() { return this.http.post<NavigationLayout>(this.config.apiUrl('/api/navigation/initialize'), {}); }
  management() { return this.http.get<NavigationLayout>(this.config.apiUrl('/api/navigation/management')); }
  save(layout: NavigationLayout) { return this.http.put<NavigationLayout>(this.config.apiUrl('/api/navigation'), layout); }
}
