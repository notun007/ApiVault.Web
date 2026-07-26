import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly state = signal<ToastMessage[]>([]);
  readonly messages = this.state.asReadonly();

  show(type: ToastType, title: string, message?: string): void {
    const id = this.nextId++;
    this.state.update((items) => [...items, { id, type, title, message }]);
    window.setTimeout(() => this.dismiss(id), type === 'error' ? 7000 : 4500);
  }

  success(title: string, message?: string): void { this.show('success', title, message); }
  error(title: string, message?: string): void { this.show('error', title, message); }
  warning(title: string, message?: string): void { this.show('warning', title, message); }
  info(title: string, message?: string): void { this.show('info', title, message); }

  dismiss(id: number): void {
    this.state.update((items) => items.filter((item) => item.id !== id));
  }
}
