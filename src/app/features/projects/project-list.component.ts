import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { readProblem } from '../../core/http/error.interceptor';
import { ApiOwnershipType, LookupResponse, VendorResponse } from '../../core/models/api.models';
import { CreateProjectRequest, ProjectCriticality, ProjectStatus, ProjectSummaryResponse } from '../../core/models/project.models';
import { UserRole } from '../../core/models/security.models';
import { AdminClient } from '../../core/services/admin.client';
import { ProjectClient } from '../../core/services/project.client';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';

type ApplicationSortField = 'name' | 'businessArea' | 'ownershipType' | 'criticality';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ModalComponent, PageHeaderComponent, EmptyStateComponent, EnumLabelPipe],
  templateUrl: './project-list.component.html',
  styleUrl: './project-list.component.scss'
})
export class ProjectListComponent {
  private readonly client = inject(ProjectClient);
  private readonly admin = inject(AdminClient);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly applications = signal<ProjectSummaryResponse[]>([]);
  readonly businessAreas = signal<LookupResponse[]>([]);
  readonly teams = signal<LookupResponse[]>([]);
  readonly vendors = signal<VendorResponse[]>([]);
  readonly editing = signal<ProjectSummaryResponse | null>(null);
  readonly loading = signal(true);
  readonly modalOpen = signal(false);
  readonly saving = signal(false);
  readonly modalError = signal('');
  readonly searchText = signal('');
  readonly statusFilter = signal('');
  readonly ownershipFilter = signal('');
  readonly sortField = signal<ApplicationSortField>('name');
  readonly sortDirection = signal<'asc' | 'desc'>('asc');
  readonly pageSize = signal(10);
  readonly currentPage = signal(1);
  readonly statuses = Object.values(ProjectStatus);
  readonly criticalities = Object.values(ProjectCriticality);
  readonly ownershipTypes = Object.values(ApiOwnershipType);
  readonly canManage = () => this.auth.hasAnyRole(UserRole.Admin, UserRole.ApiOwner);

  readonly filteredApplications = computed(() => {
    const search = this.searchText().trim().toLowerCase();
    return this.applications().filter((application) => {
      const values = [application.code, application.name, application.businessArea, application.ownerTeam, application.vendorName ?? ''];
      return (!search || values.some((value) => value.toLowerCase().includes(search)))
        && (!this.statusFilter() || application.status === this.statusFilter())
        && (!this.ownershipFilter() || application.ownershipType === this.ownershipFilter());
    });
  });

  readonly sortedApplications = computed(() => {
    const field = this.sortField();
    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    return [...this.filteredApplications()].sort((left, right) => {
      const leftValue = this.sortValue(left, field);
      const rightValue = this.sortValue(right, field);
      return typeof leftValue === 'number' && typeof rightValue === 'number'
        ? (leftValue - rightValue) * direction
        : String(leftValue).localeCompare(String(rightValue), undefined, { sensitivity: 'base' }) * direction;
    });
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.sortedApplications().length / this.pageSize())));
  readonly pagedApplications = computed(() => {
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize();
    return this.sortedApplications().slice(start, start + this.pageSize());
  });
  readonly rangeStart = computed(() => this.sortedApplications().length === 0 ? 0 : (Math.min(this.currentPage(), this.totalPages()) - 1) * this.pageSize() + 1);
  readonly rangeEnd = computed(() => Math.min(this.rangeStart() + this.pageSize() - 1, this.sortedApplications().length));

  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(50)]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    businessAreaId: ['', Validators.required],
    ownerTeamId: ['', Validators.required],
    ownershipType: [ApiOwnershipType.Internal, Validators.required],
    vendorId: [''],
    criticality: [ProjectCriticality.Medium, Validators.required],
    status: [ProjectStatus.Active, Validators.required],
    description: ['', Validators.maxLength(4000)]
  });

  constructor() {
    this.load();
    this.admin.getBusinessAreas().subscribe((items) => this.businessAreas.set(items));
    this.admin.getDevelopmentTeams().subscribe((items) => this.teams.set(items));
    this.admin.getVendors(true).subscribe((items) => this.vendors.set(items));
  }

  load(): void {
    this.loading.set(true);
    this.client.getAll().subscribe({
      next: (items) => { this.applications.set(items); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.reset({
      code: '', name: '', businessAreaId: '', ownerTeamId: '', ownershipType: ApiOwnershipType.Internal,
      vendorId: '', criticality: ProjectCriticality.Medium, status: ProjectStatus.Active, description: ''
    });
    this.modalError.set('');
    this.modalOpen.set(true);
  }

  openEdit(application: ProjectSummaryResponse, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.editing.set(application);
    this.form.reset({
      code: application.code,
      name: application.name,
      businessAreaId: application.businessAreaId ?? '',
      ownerTeamId: application.ownerTeamId ?? '',
      ownershipType: application.ownershipType,
      vendorId: application.vendorId ?? '',
      criticality: application.criticality,
      status: application.status,
      description: application.description ?? ''
    });
    this.modalError.set('');
    this.modalOpen.set(true);
  }

  save(): void {
    if (this.form.invalid || this.saving()) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    if (value.ownershipType === ApiOwnershipType.ThirdParty && !value.vendorId) {
      this.modalError.set('Select the vendor company for this third-party application.');
      return;
    }
    const request: CreateProjectRequest = {
      ...value,
      vendorId: value.ownershipType === ApiOwnershipType.ThirdParty ? value.vendorId : null,
      description: value.description || null
    };
    const current = this.editing();
    this.saving.set(true);
    (current ? this.client.update(current.id, request) : this.client.create(request)).subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.toast.success(current ? 'Application updated' : 'Application registered');
        this.load();
      },
      error: (error: HttpErrorResponse) => { this.saving.set(false); this.modalError.set(readProblem(error)); }
    });
  }

  updateSearch(value: string): void { this.searchText.set(value); this.currentPage.set(1); }
  updateStatusFilter(value: string): void { this.statusFilter.set(value); this.currentPage.set(1); }
  updateOwnershipFilter(value: string): void { this.ownershipFilter.set(value); this.currentPage.set(1); }

  updateSortField(value: string): void {
    this.sortField.set(value as ApplicationSortField);
    this.currentPage.set(1);
  }

  toggleSortDirection(): void {
    this.sortDirection.update((direction) => direction === 'asc' ? 'desc' : 'asc');
    this.currentPage.set(1);
  }

  changePageSize(value: string): void {
    this.pageSize.set(Number(value));
    this.currentPage.set(1);
  }

  previousPage(): void { this.currentPage.update((page) => Math.max(1, page - 1)); }
  nextPage(): void { this.currentPage.update((page) => Math.min(this.totalPages(), page + 1)); }

  private sortValue(application: ProjectSummaryResponse, field: ApplicationSortField): string | number {
    if (field === 'criticality') {
      return { Low: 1, Medium: 2, High: 3, Critical: 4 }[application.criticality];
    }
    return application[field] ?? '';
  }

  roleLabel(application: ProjectSummaryResponse): string {
    if (application.publishesApis && application.consumesApis) return 'Publishes & consumes';
    if (application.publishesApis) return 'Publishes APIs';
    if (application.consumesApis) return 'Consumes APIs';
    return 'No API relationships';
  }

  publisherCount(): number { return this.applications().filter((item) => item.publishesApis).length; }
  consumerCount(): number { return this.applications().filter((item) => item.consumesApis).length; }
  thirdPartyCount(): number { return this.applications().filter((item) => item.ownershipType === ApiOwnershipType.ThirdParty).length; }
}
