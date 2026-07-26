import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FormatService {
  prettyJson(value?: string | null): string {
    if (!value) return '';
    try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
  }

  normalizeJson(value?: string | null): string | null {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    return JSON.stringify(JSON.parse(trimmed));
  }

  byteSize(value: number): string {
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  }
}
