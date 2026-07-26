import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { readProblem } from '../../core/http/error.interceptor';
import { LookupResponse } from '../../core/models/api.models';
import { AdminClient } from '../../core/services/admin.client';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-reference-data',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, ModalComponent, EmptyStateComponent],
  templateUrl: './reference-data.component.html',
  styleUrl: './reference-data.component.scss'
})
export class ReferenceDataComponent {
  private readonly client = inject(AdminClient);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly businessAreas = signal<LookupResponse[]>([]);
  readonly teams = signal<LookupResponse[]>([]);
  readonly modalOpen = signal(false);
  readonly mode = signal<'business' | 'team'>('business');
  readonly saving = signal(false);
  readonly modalError = signal('');
  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(50)]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', Validators.maxLength(4000)],
    contactEmail: ['', Validators.email]
  });

  constructor() { this.load(); }
  load(): void {
    this.client.getBusinessAreas().subscribe((items) => this.businessAreas.set(items));
    this.client.getDevelopmentTeams().subscribe((items) => this.teams.set(items));
  }
  open(mode: 'business' | 'team'): void {
    this.mode.set(mode);
    this.form.reset({ code: '', name: '', description: '', contactEmail: '' });
    this.modalError.set('');
    this.modalOpen.set(true);
  }
  save(): void {
    if (this.form.invalid || this.saving()) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    const request = { ...value, description: value.description || null, contactEmail: value.contactEmail || null };
    this.saving.set(true);
    const operation = this.mode() === 'business' ? this.client.createBusinessArea(request) : this.client.createDevelopmentTeam(request);
    operation.subscribe({
      next: () => { this.saving.set(false); this.modalOpen.set(false); this.toast.success(this.mode() === 'business' ? 'Business area added' : 'Development team added'); this.load(); },
      error: (error: HttpErrorResponse) => { this.saving.set(false); this.modalError.set(readProblem(error)); }
    });
  }
}
