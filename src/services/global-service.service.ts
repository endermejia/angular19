import {
  computed,
  inject,
  Injectable,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TuiFlagPipe } from '@taiga-ui/core';
import { TranslateService } from '@ngx-translate/core';
import { LocalStorageService } from './local-storage.service';

interface User {
  name: string;
  picture: string;
}

export interface SearchItem {
  href: string;
  title: string;
  subtitle?: string;
  icon?: string;
}
export type SearchData = Record<string, readonly SearchItem[]>;

export interface OptionsItem {
  name: string;
  icon: string;
  fn?: (item: OptionsItem) => void;
}
export type OptionsData = Record<string, readonly OptionsItem[]>;

@Injectable({
  providedIn: 'root',
})
export class GlobalServiceService {
  private translate = inject(TranslateService);
  private router = inject(Router);
  private localStorage = inject(LocalStorageService);
  protected readonly flagPipe = new TuiFlagPipe();

  headerTitle: WritableSignal<string> = signal('Angular19');
  user: WritableSignal<User> = signal({
    name: 'Gabri Mejía',
    picture: 'https://gabriel-mejia.com/assets/profile.webp',
  });

  selectedLanguage: WritableSignal<string> = signal('es');
  selectedTheme: WritableSignal<'light' | 'dark'> = signal('light');

  drawer: WritableSignal<OptionsData> = signal({
    Navigation: [
      {
        name: 'Map',
        icon: '@tui.map',
        fn: (item: OptionsItem) => console.log(item.name),
      },
      {
        name: 'Zones',
        icon: '@tui.mountain',
        fn: (item: OptionsItem) => console.log(item.name),
      },
    ],
    Logbook: [
      {
        name: 'Crags',
        icon: '@tui.signpost',
        fn: (item: OptionsItem) => console.log(item.name),
      },
    ],
  });

  settings: Signal<OptionsData> = computed(() => ({
    preferences: [
      {
        name: 'settings.language',
        icon: this.flagPipe.transform(
          this.selectedLanguage() === 'es' ? 'es' : 'gb',
        ),
        fn: () => this.switchLanguage(),
      },
      {
        name: 'settings.theme',
        icon: `@tui.${this.selectedTheme() === 'dark' ? 'sun' : 'moon'}`,
        fn: () => this.switchTheme(),
      },
    ],
    account: [
      {
        name: 'settings.profile',
        icon: '@tui.user-round',
        fn: () => {
          this.router.navigate(['/profile']);
        },
      },
      {
        name: 'settings.security',
        icon: '@tui.shield',
        fn: (item: OptionsItem) => console.log(item.name),
      },
    ],
  }));

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

  private switchLanguage(): void {
    this.selectedLanguage.set(this.selectedLanguage() === 'es' ? 'en' : 'es');
    this.translate.use(this.selectedLanguage());
    this.localStorage.setItem('language', this.selectedLanguage());
  }

  private switchTheme(): void {
    this.selectedTheme.set(this.selectedTheme() === 'dark' ? 'light' : 'dark');
    this.localStorage.setItem('theme', this.selectedTheme());
  }
}
