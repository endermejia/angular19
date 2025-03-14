import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TUI_DEFAULT_MATCHER } from '@taiga-ui/cdk';
import { TuiTextfield, TuiTitle } from '@taiga-ui/core';
import {
  TuiSearchHistory,
  TuiSearchHotkey,
  TuiSearchResultsComponent,
} from '@taiga-ui/experimental';
import { TuiAvatar } from '@taiga-ui/kit';
import { TuiCell, TuiInputSearch, TuiNavigation } from '@taiga-ui/layout';
import { filter, map, startWith, switchMap, timer } from 'rxjs';
import { GlobalServiceService, SearchData } from '../../services';

@Component({
  selector: 'app-header',
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    TuiAvatar,
    TuiCell,
    TuiInputSearch,
    TuiNavigation,
    TuiTextfield,
    TuiTitle,
    TuiSearchResultsComponent,
    TuiSearchHistory,
    TuiSearchHotkey,
  ],
  templateUrl: './header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  protected globalService = inject(GlobalServiceService);

  protected readonly control = new FormControl('');

  protected readonly results$ = this.control.valueChanges.pipe(
    filter(Boolean),
    switchMap((value: string) =>
      timer(2000).pipe(
        map(() => this.filter(value)),
        startWith(null),
      ),
    ),
  );

  private filter(query: string): SearchData {
    return Object.entries(this.globalService.searchData()).reduce(
      (result, [key, value]) => ({
        ...result,
        [key]: value.filter(({ title, href, subtitle = '' }) =>
          TUI_DEFAULT_MATCHER(title + href + subtitle, query),
        ),
      }),
      {},
    );
  }
}
