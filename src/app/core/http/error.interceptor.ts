import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../services/toast.service';

interface ProblemDetails {
  title?: string;
  detail?: string;
  errors?: Record<string, string[]>;
}

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.url.includes('/config/runtime-config.json')) return next(request);
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !request.url.includes('/api/auth/login')) {
        auth.logout();
        toast.warning('Session expired', 'Please sign in again.');
        void router.navigate(['/login']);
      } else if (error.status === 403) {
        toast.error('Access denied', 'Your role does not permit this action.');
      } else if (error.status === 0) {
        toast.error('API unavailable', 'ApiVault.Api could not be reached. Check the runtime configuration and CORS settings.');
      }
      return throwError(() => error);
    })
  );
};

export function readProblem(error: unknown, fallback = 'The operation could not be completed.'): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  const body = error.error as ProblemDetails | string | null;
  if (typeof body === 'string' && body.trim()) return body;
  if (body && typeof body !== 'string') {
    if (body.errors) return Object.values(body.errors).flat().join(' ');
    return body.detail || body.title || error.message || fallback;
  }
  return error.message || fallback;
}
