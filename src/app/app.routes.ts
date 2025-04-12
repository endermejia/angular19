import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () =>
      import('../components/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('../components/profile/profile.component').then((m) => m.ProfileComponent),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];
