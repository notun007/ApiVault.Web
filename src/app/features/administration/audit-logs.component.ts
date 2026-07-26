import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuditLogResponse } from '../../core/models/test.models';
import { AdminClient } from '../../core/services/admin.client';
import { FormatService } from '../../core/services/format.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, ModalComponent, EmptyStateComponent],
  templateUrl: './audit-logs.component.html',
  styleUrl: './audit-logs.component.scss'
})
export class AuditLogsComponent {
  private readonly client = inject(AdminClient);
  readonly formatter = inject(FormatService);
  readonly logs = signal<AuditLogResponse[]>([]);
  readonly selected = signal<AuditLogResponse | null>(null);
  readonly loading = signal(true);
  entityType = '';
  entityId = '';
  take = 100;
  constructor() { this.load(); }
  load(): void { this.loading.set(true); this.client.getAuditLogs(this.entityType.trim() || undefined, this.entityId.trim() || undefined, this.take).subscribe({ next: (items) => { this.logs.set(items); this.loading.set(false); }, error: () => this.loading.set(false) }); }
  clear(): void { this.entityType = ''; this.entityId = ''; this.take = 100; this.load(); }
  formatDate(value: string): string { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value)); }
  formatTime(value: string): string { return new Intl.DateTimeFormat('en-GB', { timeStyle: 'medium' }).format(new Date(value)); }
}
