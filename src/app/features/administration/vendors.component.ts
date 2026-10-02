import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { readProblem } from '../../core/http/error.interceptor';
import { SaveVendorRequest, VendorResponse } from '../../core/models/api.models';
import { AdminClient } from '../../core/services/admin.client';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-vendors', standalone: true,
  imports: [ReactiveFormsModule, PageHeaderComponent, ModalComponent, EmptyStateComponent],
  templateUrl: './vendors.component.html', styleUrl: './vendors.component.scss'
})
export class VendorsComponent {
  private readonly client = inject(AdminClient);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly vendors = signal<VendorResponse[]>([]);
  readonly loading = signal(true);
  readonly modalOpen = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly editing = signal<VendorResponse | null>(null);
  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(50)]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', Validators.maxLength(4000)],
    contactPerson: ['', Validators.maxLength(200)],
    supportEmail: ['', Validators.email],
    supportPhone: ['', Validators.maxLength(100)],
    websiteUrl: ['', Validators.pattern(/^https?:\/\/.+/i)],
    isActive: [true]
  });
  constructor() { this.load(); }
  load(): void { this.client.getVendors().subscribe({ next: (items) => { this.vendors.set(items); this.loading.set(false); }, error: () => this.loading.set(false) }); }
  open(vendor?: VendorResponse): void {
    this.editing.set(vendor ?? null); this.errorMessage.set('');
    this.form.reset({ code: vendor?.code ?? '', name: vendor?.name ?? '', description: vendor?.description ?? '', contactPerson: vendor?.contactPerson ?? '', supportEmail: vendor?.supportEmail ?? '', supportPhone: vendor?.supportPhone ?? '', websiteUrl: vendor?.websiteUrl ?? '', isActive: vendor?.isActive ?? true });
    this.modalOpen.set(true);
  }
  save(): void {
    if (this.form.invalid || this.saving()) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    const request: SaveVendorRequest = { ...value, description: value.description || null, contactPerson: value.contactPerson || null, supportEmail: value.supportEmail || null, supportPhone: value.supportPhone || null, websiteUrl: value.websiteUrl || null };
    const vendor = this.editing(); this.saving.set(true);
    (vendor ? this.client.updateVendor(vendor.id, request) : this.client.createVendor(request)).subscribe({
      next: () => { this.saving.set(false); this.modalOpen.set(false); this.toast.success(vendor ? 'Vendor updated' : 'Vendor added'); this.load(); },
      error: (error: HttpErrorResponse) => { this.saving.set(false); this.errorMessage.set(readProblem(error)); }
    });
  }
}
