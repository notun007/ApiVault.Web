import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast-outlet',
  standalone: true,
  templateUrl: './toast-outlet.component.html',
  styleUrl: './toast-outlet.component.scss'
})
export class ToastOutletComponent {
  readonly toastService = inject(ToastService);
}
