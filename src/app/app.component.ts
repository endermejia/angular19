import { TuiRoot } from '@taiga-ui/core';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../components';
import { GlobalServiceService } from '../services';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TuiRoot, HeaderComponent],
  template: `
    <tui-root
      class="overflow-hidden"
      [attr.tuiTheme]="globalService.selectedTheme()"
    >
      <div class="h-[100vh] flex flex-col">
        <app-header />
        <router-outlet />
      </div>
    </tui-root>
  `,
})
export class AppComponent {
  protected globalService = inject(GlobalServiceService);
  // TODO: localStorage service for SSR
  // constructor() {
  //   const localStorageLang = localStorage.getItem('language');
  //   if (localStorageLang) {
  //     this.globalService.selectedLanguage.set(localStorageLang);
  //   }
  //   const localStorageTheme = localStorage.getItem('theme');
  //   if (localStorageTheme === 'dark' || localStorageTheme === 'light') {
  //     this.globalService.selectedTheme.set(localStorageTheme);
  //   }
  // }
}
