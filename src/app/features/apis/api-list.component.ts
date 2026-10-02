import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import {
  ApiLifecycleStatus,
  ApiOwnershipType,
  ApiProtocol,
  ApiCatalogSortField,
  ApiSearchQuery,
  ApiSummaryResponse,
  LookupResponse,
  PagedResult
} from '../../core/models/api.models';
import { UserRole } from '../../core/models/security.models';
import { AdminClient } from '../../core/services/admin.client';
import { ApiCatalogClient } from '../../core/services/api-catalog.client';
import { ProjectSummaryResponse } from '../../core/models/project.models';
import { ProjectClient } from '../../core/services/project.client';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';

@Component({
  selector: 'app-api-list',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, EmptyStateComponent, EnumLabelPipe],
  templateUrl: './api-list.component.html',
  styleUrl: './api-list.component.scss'
})
export class ApiListComponent {
  private readonly fb = inject(FormBuilder);
  private readonly apiClient = inject(ApiCatalogClient);
  private readonly projectClient = inject(ProjectClient);
  private readonly adminClient = inject(AdminClient);
  private readonly auth = inject(AuthService);

  readonly ownershipTypes = Object.values(ApiOwnershipType);
  readonly protocols = Object.values(ApiProtocol);
  readonly lifecycleStatuses = Object.values(ApiLifecycleStatus);
  readonly teams = signal<LookupResponse[]>([]);
  readonly applications = signal<ProjectSummaryResponse[]>([]);
  readonly loading = signal(true);
  readonly result = signal<PagedResult<ApiSummaryResponse>>({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
  readonly sortBy = signal<ApiCatalogSortField>('Name');
  readonly sortDescending = signal(false);
  readonly firstVisibleRecord = computed(() => this.result().totalCount === 0 ? 0 : ((this.result().page - 1) * this.result().pageSize) + 1);
  readonly lastVisibleRecord = computed(() => Math.min(this.result().page * this.result().pageSize, this.result().totalCount));
  readonly canManage = () => this.auth.hasAnyRole(UserRole.Admin, UserRole.ApiOwner);

  readonly filters = this.fb.nonNullable.group({
    search: '',
    ownershipType: '',
    protocol: '',
    lifecycleStatus: '',
    developmentTeamId: '',
    publishingApplicationId: ''
  });

  constructor() {
    this.adminClient.getDevelopmentTeams().subscribe((items) => this.teams.set(items));
    this.projectClient.getAll(true).subscribe((items) => this.applications.set(items));
    this.search(1);
  }

  search(page: number): void {
    this.loading.set(true);
    const filters = this.filters.getRawValue();
    const query: ApiSearchQuery = {
      search: filters.search,
      ownershipType: filters.ownershipType as ApiOwnershipType | '',
      protocol: filters.protocol as ApiProtocol | '',
      lifecycleStatus: filters.lifecycleStatus as ApiLifecycleStatus | '',
      developmentTeamId: filters.developmentTeamId,
      publishingApplicationId: filters.publishingApplicationId,
      sortBy: this.sortBy(),
      sortDescending: this.sortDescending(),
      page,
      pageSize: this.result().pageSize
    };

    this.apiClient.search(query).subscribe({
      next: (result) => { this.result.set(result); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  reset(): void {
    this.filters.reset();
    this.search(1);
  }

  changePageSize(event: Event): void {
    const pageSize = Number((event.target as HTMLSelectElement).value);
    this.result.update((result) => ({ ...result, pageSize }));
    this.search(1);
  }

  changeSort(field: ApiCatalogSortField): void {
    if (this.sortBy() === field) {
      this.sortDescending.update((descending) => !descending);
    } else {
      this.sortBy.set(field);
      this.sortDescending.set(false);
    }
    this.search(1);
  }

  sortAria(field: ApiCatalogSortField): 'ascending' | 'descending' | 'none' {
    if (this.sortBy() !== field) return 'none';
    return this.sortDescending() ? 'descending' : 'ascending';
  }
}
