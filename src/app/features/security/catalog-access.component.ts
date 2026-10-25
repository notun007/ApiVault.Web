import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminClient } from '../../core/services/admin.client';
import { SecurityClient } from '../../core/services/security.client';
import { ToastService } from '../../core/services/toast.service';
import { ApiAccessCatalogApplicationResponse, UserAccessResponse } from '../../core/models/security.models';
import { ALL_RELEASES, CatalogAssignment, CatalogProfile } from '../../core/models/catalog-access.models';
import { readProblem } from '../../core/http/error.interceptor';
import { confirmMutation } from '../../shared/confirm-mutation';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({ selector: 'app-catalog-access', standalone: true, imports: [RouterLink, PageHeaderComponent],
  templateUrl: './catalog-access.component.html', styleUrl: './catalog-access.component.scss' })
export class CatalogAccessComponent {
  private readonly admin = inject(AdminClient);
  private readonly client = inject(SecurityClient);
  private readonly toast = inject(ToastService);
  readonly users = signal<UserAccessResponse[]>([]);
  readonly catalog = signal<ApiAccessCatalogApplicationResponse[]>([]);
  readonly userId = signal(''); readonly applicationId = signal(''); readonly apiId = signal('');
  readonly scope = signal(ALL_RELEASES); readonly profile = signal<CatalogProfile>('Viewer');
  readonly draft = signal<CatalogAssignment[]>([]); readonly initial = signal<CatalogAssignment[]>([]);
  readonly loading = signal(true); readonly saving = signal(false); readonly error = signal('');
  readonly ready = signal(false); readonly legacy = signal(false); readonly allReleases = ALL_RELEASES;
  readonly changed = computed(() => JSON.stringify(this.draft()) !== JSON.stringify(this.initial()));
  readonly application = computed(() => this.catalog().find(x => x.id === this.applicationId()));
  readonly api = computed(() => this.application()?.apis.find(x => x.id === this.apiId()));
  readonly activeRows = computed(() => this.draft().filter(x => x.profile !== 'None'));
  readonly selectedUser = computed(() => this.users().find(x => x.userId === this.userId()));
  readonly profiles: CatalogProfile[] = ['Viewer', 'Maintainer', 'Manager'];
  constructor() {
    forkJoin({ users: this.admin.getUserAccess(), catalog: this.client.getApiAccessCatalog() }).subscribe({
      next: value => { this.users.set(value.users); this.catalog.set(value.catalog); this.loading.set(false); },
      error: (e: HttpErrorResponse) => { this.error.set(readProblem(e)); this.loading.set(false); }
    });
  }
  selectUser(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (this.changed() && !window.confirm('Discard unsaved catalog profiles and switch user?')) { select.value = this.userId(); return; }
    this.ready.set(false); this.userId.set(select.value); this.draft.set([]); this.initial.set([]); this.error.set(''); this.legacy.set(false);
    if (!select.value) return;
    const requestedUser = select.value; this.loading.set(true);
    this.client.getCatalogAccess(requestedUser).subscribe({
      next: value => { if (this.userId() !== requestedUser) return; this.draft.set(value.assignments); this.initial.set(value.assignments); this.ready.set(true); this.legacy.set(value.hasLegacyAssignments); this.loading.set(false); },
      error: (e: HttpErrorResponse) => { this.error.set(readProblem(e)); this.loading.set(false); }
    });
  }
  selectApplication(value: string): void { this.applicationId.set(value); this.apiId.set(''); this.scope.set(ALL_RELEASES); }
  selectApi(value: string): void { this.apiId.set(value); this.scope.set(ALL_RELEASES); }
  apply(): void {
    if (!this.application() || !this.selectedUser()?.isActive || this.loading() || !this.ready() || this.saving()) return;
    const apis = this.api() ? [this.api()!] : this.application()!.apis;
    let next = [...this.draft()];
    for (const api of apis) {
      const scope = this.api() ? this.scope() : ALL_RELEASES;
      next = next.map(row => row.apiId === api.id && (scope === ALL_RELEASES || row.releaseScopeId === ALL_RELEASES) ? { ...row, profile: 'None' as CatalogProfile } : row);
      const index = next.findIndex(x => x.apiId === api.id && x.releaseScopeId === scope);
      const assignment = { apiId: api.id, releaseScopeId: scope, profile: this.profile() };
      if (index >= 0) next[index] = assignment; else next.push(assignment);
    }
    this.draft.set(next);
  }
  remove(row: CatalogAssignment): void { this.draft.update(rows => rows.map(x => x === row ? { ...x, profile: 'None' } : x)); }
  discard(): void { this.draft.set(this.initial()); this.error.set(''); }
  apiName(row: CatalogAssignment): string { return this.catalog().flatMap(a => a.apis).find(a => a.id === row.apiId)?.name ?? row.apiId; }
  applicationName(row: CatalogAssignment): string { return this.catalog().find(a => a.apis.some(api => api.id === row.apiId))?.name ?? ''; }
  scopeName(row: CatalogAssignment): string { return row.releaseScopeId === ALL_RELEASES ? 'All releases · includes future releases' : this.catalog().flatMap(a => a.apis).find(a => a.id === row.apiId)?.releases.find(r => r.id === row.releaseScopeId)?.version ?? 'Selected release'; }
  save(): void {
    if (!this.ready() || !this.changed() || this.saving() || this.loading() || !this.selectedUser()?.isActive) return;
    if (!confirmMutation('save', `catalog profiles for ${this.selectedUser()?.displayName}`)) return;
    this.saving.set(true); this.error.set('');
    this.client.saveCatalogAccess(this.userId(), this.draft()).subscribe({
      next: () => { this.initial.set(this.draft()); this.saving.set(false); this.toast.success('Catalog profiles saved'); },
      error: (e: HttpErrorResponse) => { this.error.set(readProblem(e)); this.saving.set(false); }
    });
  }
}

