import {
  ChangeDetectionStrategy,
  Component,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { TuiTitle } from '@taiga-ui/core';
import { TuiHeader } from '@taiga-ui/layout';
import { TuiAvatar } from '@taiga-ui/kit';
import { GlobalServiceService } from '../../services';

@Component({
  selector: 'app-profile',
  imports: [TuiTitle, TuiHeader, TuiAvatar, TranslatePipe],
  templateUrl: './profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex grow',
  },
})
export class ProfileComponent {
  constructor(protected readonly globalService: GlobalServiceService) {
    // Set the header title when this component is loaded
    this.globalService.headerTitle.set('Profile');
  }
}
