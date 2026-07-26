import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { readProblem } from '../../core/http/error.interceptor';
import { ApiOwnershipType, ApiProtocol, CreateApiRequest, LookupResponse } from '../../core/models/api.models';
import { AdminClient } from '../../core/services/admin.client';
import { ApiCatalogClient } from '../../core/services/api-catalog.client';
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
  private readonly toast = inject(ToastService);

  readonly apiId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly editing = signal(!!this.apiId);
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly businessAreas = signal<LookupResponse[]>([]);
  readonly teams = signal<LookupResponse[]>([]);
  readonly ownershipTypes = Object.values(ApiOwnershipType);
  readonly protocols = Object.values(ApiProtocol);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    apiProjectName: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', Validators.maxLength(4000)],
    ownershipType: [ApiOwnershipType.Internal, Validators.required],
    protocol: [ApiProtocol.Rest, Validators.required],
    creatorName: ['', [Validators.required, Validators.maxLength(200)]],
    creatorEmail: ['', Validators.email],
    vendorName: ['', Validators.maxLength(200)],
    externalReferenceUrl: ['', Validators.pattern(/^https?:\/\/.+/i)],
    businessAreaId: ['', Validators.required],
    developmentTeamId: ['', Validators.required]
  });

  constructor() {
    forkJoin({
      businessAreas: this.adminClient.getBusinessAreas(),
      teams: this.adminClient.getDevelopmentTeams(),
      api: this.apiId ? this.apiClient.get(this.apiId) : of(null)
    }).subscribe(({ businessAreas, teams, api }) => {
      this.businessAreas.set(businessAreas);
      this.teams.set(teams);
      if (api) {
        this.form.patchValue({
          name: api.name,
          apiProjectName: api.apiProjectName,
          description: api.description ?? '',
          ownershipType: api.ownershipType,
          protocol: api.protocol,
          creatorName: api.creatorName,
          creatorEmail: api.creatorEmail ?? '',
          vendorName: api.vendorName ?? '',
          externalReferenceUrl: api.externalReferenceUrl ?? '',
          businessAreaId: api.businessArea.id,
          developmentTeamId: api.developmentTeam.id
        });
      }
    });
  }

  invalid(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.errorMessage.set('');
    const value = this.form.getRawValue();
    const request: CreateApiRequest = {
      ...value,
      description: value.description || null,
      creatorEmail: value.creatorEmail || null,
      vendorName: value.vendorName || null,
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
