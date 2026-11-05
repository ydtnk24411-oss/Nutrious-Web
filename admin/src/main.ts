import { bootstrapApplication } from '@angular/platform-browser';
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { adminRoutes } from './app/admin/admin.routes';
import { authInterceptor } from './app/shared/interceptors/auth.interceptor';

const adminConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(adminRoutes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
  ],
};

bootstrapApplication(AppComponent, adminConfig).catch((err) => console.error(err));
