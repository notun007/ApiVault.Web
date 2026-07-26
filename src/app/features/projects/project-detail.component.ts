import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { readProblem } from '../../core/http/error.interceptor';
import { ApiDetailResponse, ApiSummaryResponse, ApiVersionResponse } from '../../core/models/api.models';
import { ProjectDetailResponse } from '../../core/models/project.models';
import { UserRole } from '../../core/models/security.models';
import { ApiCatalogClient } from '../../core/services/api-catalog.client';
import { ProjectClient } from '../../core/services/project.client';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ModalComponent, PageHeaderComponent, EmptyStateComponent],
  templateUrl: './project-detail.component.html',
  styleUrl: './project-detail.component.scss'
})
export class ProjectDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly projectClient = inject(ProjectClient);
  private readonly apiClient = inject(ApiCatalogClient);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly project = signal<ProjectDetailResponse | null>(null);
  readonly apis = signal<ApiSummaryResponse[]>([]);
  readonly selectedApi = signal<ApiDetailResponse | null>(null);
  readonly loading = signal(true);
  readonly modalOpen = signal(false);
  readonly saving = signal(false);
  readonly modalError = signal('');
  readonly canManage = () => this.auth.hasAnyRole(UserRole.Admin, UserRole.ApiOwner);
  readonly availableVersions = computed<ApiVersionResponse[]>(() => this.selectedApi()?.versions ?? []);

  readonly form = this.fb.nonNullable.group({
    apiId: ['', Validators.required],
    apiVersionId: ['', Validators.required],
    purpose: ['', Validators.maxLength(2000)],
    isRequired: [true]
  });

  constructor() { this.reload(); }

  reload(): void {
    this.projectClient.get(this.id).subscribe({ next: (item) => { this.project.set(item); this.loading.set(false); }, error: () => this.loading.set(false) });
  }

  openLink(): void {
    this.form.reset({ apiId: '', apiVersionId: '', purpose: '', isRequired: true });
    this.selectedApi.set(null);
    this.modalError.set('');
    this.modalOpen.set(true);
    if (this.apis().length === 0) this.apiClient.search({ page: 1, pageSize: 200 }).subscribe((result) => this.apis.set(result.items));
  }

  loadApiVersions(): void {
    const apiId = this.form.controls.apiId.value;
    this.form.controls.apiVersionId.setValue('');
    if (!apiId) { this.selectedApi.set(null); return; }
    this.apiClient.get(apiId).subscribe((api) => this.selectedApi.set(api));
  }

  saveLink(): void {
    if (this.form.invalid || this.saving()) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.projectClient.linkApiVersion(this.id, { apiVersionId: value.apiVersionId, purpose: value.purpose || null, isRequired: value.isRequired }).subscribe({
      next: (project) => { this.project.set(project); this.saving.set(false); this.modalOpen.set(false); this.toast.success('API version linked to project'); },
      error: (error: HttpErrorResponse) => { this.saving.set(false); this.modalError.set(readProblem(error)); }
    });
  }
}
