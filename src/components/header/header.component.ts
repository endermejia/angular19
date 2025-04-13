import { AsyncPipe, KeyValuePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { TUI_DEFAULT_MATCHER } from '@taiga-ui/cdk';
import {
  TuiButton,
  TuiDataListComponent,
  TuiDropdown,
  TuiOptGroup,
  TuiTextfield,
  TuiTitle,
} from '@taiga-ui/core';
import { TuiOption } from '@taiga-ui/core/components/data-list';
import {
  TuiSearchHistory,
  TuiSearchHotkey,
  TuiSearchResultsComponent,
} from '@taiga-ui/experimental';
import { TuiAvatar } from '@taiga-ui/kit';
import { TuiCell, TuiInputSearch, TuiNavigation } from '@taiga-ui/layout';
import { filter, map, startWith, switchMap, timer } from 'rxjs';
import { GlobalServiceService, OptionsItem, SearchData } from '../../services';

@Component({
  selector: 'app-header',
  imports: [
    AsyncPipe,
    KeyValuePipe,
    ReactiveFormsModule,
    TuiAvatar,
    TuiButton,
    TuiCell,
    TuiDataListComponent,
    TuiDropdown,
    TuiInputSearch,
    TuiNavigation,
    TuiOptGroup,
    TuiOption,
    TuiSearchHistory,
    TuiSearchHotkey,
    TuiSearchResultsComponent,
    TuiTextfield,
    TuiTitle,
    TranslatePipe,
  ],
  templateUrl: './header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  protected globalService = inject(GlobalServiceService);

  open = false;
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

  protected onClick(item: OptionsItem) {
    item?.fn?.(item);
  }

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
