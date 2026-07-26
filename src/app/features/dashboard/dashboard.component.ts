import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiLifecycleStatus, ApiSummaryResponse } from '../../core/models/api.models';
import { ProjectSummaryResponse } from '../../core/models/project.models';
import { UserRole } from '../../core/models/security.models';
import { TestExecutionResponse } from '../../core/models/test.models';
import { ApiCatalogClient } from '../../core/services/api-catalog.client';
import { ProjectClient } from '../../core/services/project.client';
import { TestClient } from '../../core/services/test.client';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, EmptyStateComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  private readonly apiClient = inject(ApiCatalogClient);
  private readonly projectClient = inject(ProjectClient);
  private readonly testClient = inject(TestClient);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly apis = signal<ApiSummaryResponse[]>([]);
  readonly projects = signal<ProjectSummaryResponse[]>([]);
  readonly tests = signal<TestExecutionResponse[]>([]);
  readonly canManage = () => this.auth.hasAnyRole(UserRole.Admin, UserRole.ApiOwner);

  constructor() {
    forkJoin({
      apis: this.apiClient.search({ page: 1, pageSize: 200 }),
      projects: this.projectClient.getAll(),
      tests: this.testClient.history(undefined, undefined, 20)
    }).subscribe({
      next: ({ apis, projects, tests }) => {
        this.apis.set(apis.items);
        this.projects.set(projects);
        this.tests.set(tests);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  internalApiCount(): number { return this.apis().filter((api) => api.ownershipType === 'Internal').length; }
  thirdPartyApiCount(): number { return this.apis().filter((api) => api.ownershipType === 'ThirdParty').length; }
  activeCount(): number { return this.apis().filter((api) => api.currentLifecycleStatus === ApiLifecycleStatus.Active).length; }
  deprecatedCount(): number { return this.apis().filter((api) => api.currentLifecycleStatus === ApiLifecycleStatus.Deprecated).length; }
  retiredCount(): number { return this.apis().filter((api) => api.currentLifecycleStatus === ApiLifecycleStatus.Retired).length; }
  criticalProjects(): number { return this.projects().filter((project) => project.criticality === 'Critical').length; }
  successfulTests(): number { return this.tests().filter((test) => test.isSuccess).length; }
  topProjects(): ProjectSummaryResponse[] { return [...this.projects()].sort((a, b) => b.linkedApiVersionCount - a.linkedApiVersionCount).slice(0, 5); }

  lifecycleRows() {
    const total = Math.max(this.apis().length, 1);
    const values = [
      { label: 'Active', status: ApiLifecycleStatus.Active, className: 'active' },
      { label: 'Draft', status: ApiLifecycleStatus.Draft, className: 'draft' },
      { label: 'Deprecated', status: ApiLifecycleStatus.Deprecated, className: 'deprecated' },
      { label: 'Retired', status: ApiLifecycleStatus.Retired, className: 'retired' }
    ];
    return values.map((item) => {
      const count = this.apis().filter((api) => api.currentLifecycleStatus === item.status).length;
      return { ...item, count, percent: (count / total) * 100 };
    });
  }

  statusClass(status?: string | null): string {
    return status ? `status-${status.toLowerCase()}` : 'status-neutral';
  }
}
