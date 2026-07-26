import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { RuntimeConfigService } from '../../core/config/runtime-config.service';
import { readProblem } from '../../core/http/error.interceptor';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  readonly runtime = inject(RuntimeConfigService);

  readonly submitting = signal(false);
  readonly showPassword = signal(false);
  readonly errorMessage = signal('');
  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required]
  });

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set('');
    this.auth.login(this.form.getRawValue()).subscribe({
      next: (res) => {

        if (res) {

                  if (res.isSuccess) {
                    this.toast.success('Welcome to ApiVault');
                    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
                    void this.router.navigateByUrl(returnUrl);
                  } 
                  else {
                    this.toast.error(
                      'Login Failed',
                      res.message ?? 'Check your username and password.'
                    );
                    this.submitting.set(false);
                  }
                }

        //this.toast.success(JSON.stringify(res));
        // const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
        // void this.router.navigateByUrl(returnUrl);
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(readProblem(error, 'Check your username and password.'));
        this.submitting.set(false);
      }
    });
  }
}
