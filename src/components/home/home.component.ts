import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { TuiBottomSheet } from '@taiga-ui/addon-mobile';
import { TuiButton, TuiTitle } from '@taiga-ui/core';
import { TuiHeader } from '@taiga-ui/layout';

@Component({
  selector: 'app-home',
  imports: [TuiBottomSheet, TuiButton, TuiTitle, TuiHeader],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex grow',
  },
})
export class HomeComponent {
  @ViewChild('buttons')
  protected readonly button?: ElementRef<HTMLElement>;
  protected readonly stops = ['112px'] as const;

  protected onScroll({ clientHeight, scrollTop }: HTMLElement): void {
    const offset = Number.parseInt(this.stops[0], 10);
    const top = Math.min(scrollTop, clientHeight - offset);
    const transform = `translate3d(0, ${-top}px, 0)`;

    this.button?.nativeElement.style.setProperty('transform', transform);
  }
}
