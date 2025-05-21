import { TuiRoot } from '@taiga-ui/core';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../components';
import { GlobalServiceService, LocalStorageService } from '../services';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TuiRoot, HeaderComponent],
  template: `
    <tui-root
      class="overflow-hidden"
      [attr.tuiTheme]="globalService.selectedTheme()"
    >
      <div class="h-[100dvh] flex flex-col">
        <app-header />
        <router-outlet />
      </div>
    </tui-root>
  `,
})
export class AppComponent {
  protected globalService = inject(GlobalServiceService);
  private localStorage = inject(LocalStorageService);

  constructor() {
    const localStorageLang = this.localStorage.getItem('language');
    if (localStorageLang === 'es' || localStorageLang === 'en') {
      this.globalService.selectedLanguage.set(localStorageLang);
    }
    const localStorageTheme = this.localStorage.getItem('theme');
    if (localStorageTheme === 'dark' || localStorageTheme === 'light') {
      this.globalService.selectedTheme.set(
        localStorageTheme as 'dark' | 'light',
      );
    }
  }
}
