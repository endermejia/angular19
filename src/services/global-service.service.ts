import { Injectable, signal, WritableSignal } from '@angular/core';

interface User {
  name: string;
  picture: string;
}

interface Result {
  href: string;
  title: string;
  subtitle?: string;
  icon?: string;
}

export type SearchData = Record<string, readonly Result[]>;

@Injectable({
  providedIn: 'root',
})
export class GlobalServiceService {
  headerTitle: WritableSignal<string> = signal('Angular19');
  user: WritableSignal<User> = signal({
    name: 'Gabri Mejía',
    picture: 'https://gabriel-mejia.com/assets/profile.webp',
  });

  searchPopular: WritableSignal<string[]> = signal(['Onil', 'El Tormo']);
  searchData: WritableSignal<SearchData> = signal({
    Zones: [
      {
        title: 'Onil',
        href: 'https://www.example.com',
        icon: '@tui.mountain',
      },
    ],
    Crags: [
      {
        title: 'El Tormo',
        href: 'https://www.example.com',
        icon: '@tui.signpost',
      },
    ],
    Routes: [
      {
        title: 'Speedy Gonzales',
        href: 'https://www.example.com',
        icon: '@tui.route',
      },
    ],
  });
}
