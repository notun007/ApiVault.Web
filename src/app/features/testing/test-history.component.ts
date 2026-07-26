import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TestExecutionResponse } from '../../core/models/test.models';
import { FormatService } from '../../core/services/format.service';
import { TestClient } from '../../core/services/test.client';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-test-history',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, EmptyStateComponent, ModalComponent],
  templateUrl: './test-history.component.html',
  styleUrl: './test-history.component.scss'
})
export class TestHistoryComponent {
  private readonly client = inject(TestClient);
  readonly formatter = inject(FormatService);
  readonly history = signal<TestExecutionResponse[]>([]);
  readonly selected = signal<TestExecutionResponse | null>(null);
  readonly loading = signal(true);
  endpointId = '';
  environmentId = '';
  take = 50;

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.client.history(this.endpointId.trim() || undefined, this.environmentId.trim() || undefined, this.take).subscribe({
      next: (items) => { this.history.set(items); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  clearFilters(): void { this.endpointId = ''; this.environmentId = ''; this.take = 50; this.load(); }
  formatDate(value: string): string { return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value)); }
  formatTime(value: string): string { return new Intl.DateTimeFormat('en-GB', { timeStyle: 'medium' }).format(new Date(value)); }
}
