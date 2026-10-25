import { confirmMutation } from '../../shared/confirm-mutation';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { readProblem } from '../../core/http/error.interceptor';
import { LookupResponse } from '../../core/models/api.models';
import { CreateLookupRequest } from '../../core/models/security.models';
import { AdminClient } from '../../core/services/admin.client';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-business-areas',
  standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, ModalComponent, EmptyStateComponent],
  templateUrl: './business-areas.component.html',
  styleUrl: './reference-management.scss'
})
export class BusinessAreasComponent {
  private readonly client = inject(AdminClient);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly items = signal<LookupResponse[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly editorOpen = signal(false);
  readonly editing = signal<LookupResponse | null>(null);
  readonly saving = signal(false);
  readonly editorError = signal('');
  readonly deleteTarget = signal<LookupResponse | null>(null);
  readonly deleting = signal(false);
  readonly deleteError = signal('');
  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(50)]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', Validators.maxLength(4000)]
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.client.getBusinessAreas().subscribe({
      next: (items) => { this.items.set(items); this.loading.set(false); },
      error: (error: HttpErrorResponse) => { this.loadError.set(readProblem(error, 'Could not load business areas.')); this.loading.set(false); }
    });
  }

  open(item?: LookupResponse): void {
    this.editing.set(item ?? null);
    this.editorError.set('');
    this.form.reset({ code: item?.code ?? '', name: item?.name ?? '', description: item?.description ?? '' });
    this.editorOpen.set(true);
  }

  save(): void {
    if (this.form.invalid || this.saving()) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    const request: CreateLookupRequest = { code: value.code, name: value.name, description: value.description || null };
    const item = this.editing();
    if (!confirmMutation(item ? 'update' : 'create', 'this business area')) return;
    this.saving.set(true);
    (item ? this.client.updateBusinessArea(item.id, request) : this.client.createBusinessArea(request)).subscribe({
      next: () => {
        this.saving.set(false);
        this.editorOpen.set(false);
        this.toast.success(item ? 'Business area updated' : 'Business area added');
        this.load();
      },
      error: (error: HttpErrorResponse) => { this.saving.set(false); this.editorError.set(readProblem(error)); }
    });
  }

  askDelete(item: LookupResponse): void {
    if (!item.canDelete) return;
    this.deleteError.set('');
    this.deleteTarget.set(item);
  }

  delete(): void {
    const item = this.deleteTarget();
    if (!item || this.deleting()) return;
    this.deleting.set(true);
    this.client.deleteBusinessArea(item.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
        this.toast.success('Business area deleted');
        this.load();
      },
      error: (error: HttpErrorResponse) => { this.deleting.set(false); this.deleteError.set(readProblem(error)); }
    });
  }
}
