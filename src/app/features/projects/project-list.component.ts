import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { readProblem } from '../../core/http/error.interceptor';
import { LookupResponse } from '../../core/models/api.models';
import { CreateProjectRequest, ProjectCriticality, ProjectStatus, ProjectSummaryResponse } from '../../core/models/project.models';
import { UserRole } from '../../core/models/security.models';
import { AdminClient } from '../../core/services/admin.client';
import { ProjectClient } from '../../core/services/project.client';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';

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

  readonly projects = signal<ProjectSummaryResponse[]>([]);
  readonly businessAreas = signal<LookupResponse[]>([]);
  readonly teams = signal<LookupResponse[]>([]);
  readonly loading = signal(true);
  readonly modalOpen = signal(false);
  readonly saving = signal(false);
  readonly modalError = signal('');
  readonly searchText = signal('');
  readonly statusFilter = signal('');
  readonly criticalityFilter = signal('');
  readonly statuses = Object.values(ProjectStatus);
  readonly criticalities = Object.values(ProjectCriticality);
  readonly canManage = () => this.auth.hasAnyRole(UserRole.Admin, UserRole.ApiOwner);

  readonly filteredProjects = computed(() => {
    const search = this.searchText().trim().toLowerCase();
    return this.projects().filter((project) => {
      const matchesSearch = !search || [project.code, project.name, project.businessArea, project.ownerTeam].some((value) => value.toLowerCase().includes(search));
      return matchesSearch && (!this.statusFilter() || project.status === this.statusFilter()) && (!this.criticalityFilter() || project.criticality === this.criticalityFilter());
    });
  });

  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(50)]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', Validators.maxLength(4000)],
    criticality: [ProjectCriticality.Medium, Validators.required],
    status: [ProjectStatus.Active, Validators.required],
    businessAreaId: ['', Validators.required],
    ownerTeamId: ['', Validators.required]
  });

  constructor() {
    this.load();
    this.admin.getBusinessAreas().subscribe((items) => this.businessAreas.set(items));
    this.admin.getDevelopmentTeams().subscribe((items) => this.teams.set(items));
  }

  load(): void {
    this.client.getAll().subscribe({ next: (items) => { this.projects.set(items); this.loading.set(false); }, error: () => this.loading.set(false) });
  }

  openCreate(): void {
    this.form.reset({ code: '', name: '', description: '', criticality: ProjectCriticality.Medium, status: ProjectStatus.Active, businessAreaId: '', ownerTeamId: '' });
    this.modalError.set('');
    this.modalOpen.set(true);
  }

  save(): void {
    if (this.form.invalid || this.saving()) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    const request: CreateProjectRequest = { ...value, description: value.description || null };
    this.saving.set(true);
    this.client.create(request).subscribe({
      next: () => { this.saving.set(false); this.modalOpen.set(false); this.toast.success('Project registered'); this.load(); },
      error: (error: HttpErrorResponse) => { this.saving.set(false); this.modalError.set(readProblem(error)); }
    });
  }

  criticalCount(): number { return this.projects().filter((project) => project.criticality === ProjectCriticality.Critical).length; }
  activeCount(): number { return this.projects().filter((project) => project.status === ProjectStatus.Active).length; }
  linkCount(): number { return this.projects().reduce((sum, project) => sum + project.linkedApiVersionCount, 0); }
}
