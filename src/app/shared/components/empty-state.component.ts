import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss'
})
export class EmptyStateComponent {
  @Input() symbol = '—';
  @Input() title = 'No records found';
  @Input() message = 'There is no information to display yet.';
}
