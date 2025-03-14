import { TuiRoot } from '@taiga-ui/core';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../components';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TuiRoot, HeaderComponent],
  template: `
    <tui-root class="overflow-hidden">
      <div class="h-[100vh] flex flex-col">
        <app-header />
        <router-outlet />
      </div>
    </tui-root>
  `,
})
export class AppComponent {}
