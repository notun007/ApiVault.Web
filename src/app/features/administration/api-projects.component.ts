import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { readProblem } from '../../core/http/error.interceptor';
import { ApiProjectResponse, CreateApiProjectRequest } from '../../core/models/api.models';
import { ApiProjectClient } from '../../core/services/api-project.client';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-api-projects',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, ModalComponent, EmptyStateComponent],
  templateUrl: './api-projects.component.html',
  styleUrl: './api-projects.component.scss'
})
export class ApiProjectsComponent {
  private readonly client = inject(ApiProjectClient);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly projects = signal<ApiProjectResponse[]>([]);
  readonly loading = signal(true);
  readonly modalOpen = signal(false);
  readonly saving = signal(false);
  readonly modalError = signal('');
  readonly editing = signal<ApiProjectResponse | null>(null);
  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(100)]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', Validators.maxLength(4000)],
    isActive: [true]
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.client.getAll().subscribe({
      next: (items) => { this.projects.set(items); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.reset({ code: '', name: '', description: '', isActive: true });
    this.modalError.set('');
    this.modalOpen.set(true);
  }

  openEdit(project: ApiProjectResponse): void {
    this.editing.set(project);
    this.form.reset({ code: project.code, name: project.name, description: project.description ?? '', isActive: project.isActive });
    this.modalError.set('');
    this.modalOpen.set(true);
  }

  save(): void {
    if (this.form.invalid || this.saving()) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    const request: CreateApiProjectRequest = { ...value, description: value.description || null };
    
    console.log('Saving API project', request);
    
    const project = this.editing();
    this.saving.set(true);
    const operation = project ? this.client.update(project.id, request) : this.client.create(request);
    operation.subscribe({
      next: () => { this.saving.set(false); this.modalOpen.set(false); this.toast.success(project ? 'API project updated' : 'API project added'); this.load(); },
      error: (error: HttpErrorResponse) => { this.saving.set(false); this.modalError.set(readProblem(error)); }
    });
  }

  deactivate(project: ApiProjectResponse): void {
    if (!project.isActive || this.saving()) return;
    this.client.deactivate(project.id).subscribe({
      next: () => { this.toast.success('API project deactivated'); this.load(); },
      error: (error: HttpErrorResponse) => this.toast.error(readProblem(error))
    });
  }
}
