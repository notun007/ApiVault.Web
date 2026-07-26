import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface KeyValueRow {
  key: string;
  value: string;
  enabled: boolean;
}

@Component({
  selector: 'app-key-value-editor',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './key-value-editor.component.html',
  styleUrl: './key-value-editor.component.scss'
})
export class KeyValueEditorComponent {
  @Input() rows: KeyValueRow[] = [];
  @Input() keyPlaceholder = 'Key';
  @Input() valuePlaceholder = 'Value';
  @Output() readonly rowsChange = new EventEmitter<KeyValueRow[]>();

  add(): void {
    this.rows = [...this.rows, { key: '', value: '', enabled: true }];
    this.emitChange();
  }

  remove(index: number): void {
    this.rows = this.rows.filter((_, itemIndex) => itemIndex !== index);
    this.emitChange();
  }

  emitChange(): void {
    this.rowsChange.emit(this.rows.map((row) => ({ ...row })));
  }
}
