import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'enumLabel', standalone: true })
export class EnumLabelPipe implements PipeTransform {
  transform(value?: string | null): string {
    if (!value) return '—';
    return value
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/Uat/g, 'UAT')
      .replace(/Oauth2/gi, 'OAuth 2')
      .replace(/Api/g, 'API')
      .replace(/Tls/g, 'TLS');
  }
}
