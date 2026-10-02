import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { readProblem } from '../../core/http/error.interceptor';
import { ApiOwnershipType, ApiProtocol, CreateApiRequest, VendorResponse } from '../../core/models/api.models';
import { ProjectSummaryResponse } from '../../core/models/project.models';
import { ApiCatalogClient } from '../../core/services/api-catalog.client';
import { AdminClient } from '../../core/services/admin.client';
import { ProjectClient } from '../../core/services/project.client';
import { ToastService } from '../../core/services/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { EnumLabelPipe } from '../../shared/pipes/enum-label.pipe';

@Component({
  selector: 'app-api-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, EnumLabelPipe],
  templateUrl: './api-form.component.html',
  styleUrl: './api-form.component.scss'
})
export class ApiFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apiClient = inject(ApiCatalogClient);
  private readonly adminClient = inject(AdminClient);
  private readonly projectClient = inject(ProjectClient);
  private readonly toast = inject(ToastService);

  readonly apiId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly editing = signal(!!this.apiId);
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly applications = signal<ProjectSummaryResponse[]>([]);
  readonly vendors = signal<VendorResponse[]>([]);
  readonly protocols = Object.values(ApiProtocol);
  readonly ownershipTypes = Object.values(ApiOwnershipType);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    ownershipType: [ApiOwnershipType.Internal, Validators.required],
    vendorCompanyId: [''],
    publishingApplicationId: ['', Validators.required],
    protocol: [ApiProtocol.Rest, Validators.required],
    description: ['', Validators.maxLength(4000)],
    externalReferenceUrl: ['', Validators.pattern(/^https?:\/\/.+/i)]
  });

  filteredApplications(): ProjectSummaryResponse[] {
    const ownershipType = this.form.controls.ownershipType.value;
    const vendorCompanyId = this.form.controls.vendorCompanyId.value;
    return this.applications().filter((application) =>
      application.ownershipType === ownershipType
      && (ownershipType !== ApiOwnershipType.ThirdParty || (!!vendorCompanyId && application.vendorId === vendorCompanyId))
    );
  }

  constructor() {
    forkJoin({
      applications: this.projectClient.getAll(true),
      vendors: this.adminClient.getVendors(true),
      api: this.apiId ? this.apiClient.get(this.apiId) : of(null)
    }).subscribe({
      next: ({ applications, vendors, api }) => {
        this.applications.set(applications);
        this.vendors.set(vendors);
        if (api) {
          const publishingApplication = applications.find((application) => application.id === api.publishingApplicationId);
          this.form.patchValue({
            name: api.name,
            ownershipType: publishingApplication?.ownershipType ?? api.ownershipType,
            vendorCompanyId: publishingApplication?.vendorId ?? '',
            publishingApplicationId: api.publishingApplicationId,
            protocol: api.protocol,
            description: api.description ?? '',
            externalReferenceUrl: api.externalReferenceUrl ?? ''
          });
        }
      },
      error: (error: HttpErrorResponse) => this.errorMessage.set(readProblem(
        error,
        'Could not load API registration data. Check that ApiVault.Api is running and reachable.'
      ))
    });
  }

  invalid(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  selectedApplication(): ProjectSummaryResponse | undefined {
    return this.applications().find((item) => item.id === this.form.controls.publishingApplicationId.value);
  }

  ownershipChanged(): void {
    this.form.patchValue({ vendorCompanyId: '', publishingApplicationId: '' });
  }

  vendorChanged(): void {
    this.form.controls.publishingApplicationId.setValue('');
  }

  vendorInvalid(): boolean {
    return this.form.controls.ownershipType.value === ApiOwnershipType.ThirdParty
      && !this.form.controls.vendorCompanyId.value
      && (this.form.controls.vendorCompanyId.touched || this.form.controls.publishingApplicationId.touched);
  }

  save(): void {
    if (this.form.controls.ownershipType.value === ApiOwnershipType.ThirdParty && !this.form.controls.vendorCompanyId.value) {
      this.form.controls.vendorCompanyId.markAsTouched();
      return;
    }
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.errorMessage.set('');
    const value = this.form.getRawValue();
    const request: CreateApiRequest = {
      name: value.name,
      publishingApplicationId: value.publishingApplicationId,
      protocol: value.protocol,
      description: value.description || null,
      externalReferenceUrl: value.externalReferenceUrl || null
    };
    const operation = this.apiId ? this.apiClient.update(this.apiId, request) : this.apiClient.create(request);
    operation.subscribe({
      next: (api) => {
        this.toast.success(this.apiId ? 'API registration updated' : 'API registered');
        void this.router.navigate(['/apis', api.id]);
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(readProblem(error));
        this.saving.set(false);
      }
    });
  }
}
