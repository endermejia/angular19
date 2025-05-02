import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  inject,
  PLATFORM_ID,
  signal,
  WritableSignal,
  AfterViewInit,
  ChangeDetectorRef,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TuiBottomSheet } from '@taiga-ui/addon-mobile';
import { TuiButton, TuiLoader, TuiTitle } from '@taiga-ui/core';
import { TuiHeader } from '@taiga-ui/layout';
import { TranslateService } from '@ngx-translate/core';
import { MapService } from '../../services';
// Import types only, not the actual library
import type * as L from 'leaflet';

@Component({
  selector: 'app-home',
  imports: [TuiBottomSheet, TuiButton, TuiTitle, TuiHeader, TuiLoader],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MapService],
  host: {
    class: 'flex grow',
  },
})
export class HomeComponent implements AfterViewInit {
  @ViewChild('buttons')
  protected readonly button?: ElementRef<HTMLElement>;
  protected readonly stops = ['112px'] as const;

  // Properties for the bottom-sheet content using signals
  protected locationName: WritableSignal<string> = signal('Your Location');
  protected locationRegion: WritableSignal<string> = signal('');
  protected locationDetails: WritableSignal<
    { label: string; value: string }[]
  > = signal([]);
  protected locationDescription: WritableSignal<string> = signal(
    'Click on a marker to see information about the location.',
  );
  protected mapUrl: WritableSignal<string> = signal(
    'https://www.google.com/maps',
  );
  protected websiteUrl: WritableSignal<string> = signal('');

  private map?: L.Map;
  private readonly platformId = inject(PLATFORM_ID);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly mapService = inject(MapService);

  ngAfterViewInit(): void {
    // Only proceed in browser environment
    if (!isPlatformBrowser(this.platformId)) {
      console.log('Not in browser environment, skipping map initialization');
      return;
    }

    // Use setTimeout to ensure DOM is fully rendered
    setTimeout(() => {
      // Initialize the map
      this.initializeMap();
    }, 0);
  }

  private async initializeMap(retryCount = 0): Promise<void> {
    // Only proceed in browser environment
    if (!isPlatformBrowser(this.platformId)) {
      console.log('Not in browser environment, skipping map initialization');
      return;
    }

    // Ensure the map container exists before proceeding
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
      console.error('Map container not found, delaying initialization');
      if (retryCount < 3) {
        setTimeout(() => {
          this.initializeMap(retryCount + 1);
        }, 500);
      }
      return;
    }

    console.log(`Initializing map (attempt ${retryCount + 1})...`);

    try {
      // Use the enhanced method to ensure Leaflet is fully loaded
      const leaflet = await this.mapService.ensureLeafletLoaded();

      if (!leaflet) {
        console.error('Failed to load Leaflet after multiple attempts');
        this.handleLeafletLoadError(retryCount);
        return;
      }

      // Double-check Map constructor is available
      if (!leaflet.Map) {
        console.error('Leaflet Map constructor not available after loading');
        this.handleLeafletLoadError(retryCount);
        return;
      }

      // Initialize the map using the MapService
      this.map = this.mapService.initMap('map');

      if (!this.map) {
        console.error('Failed to initialize map');
        this.handleLeafletLoadError(retryCount);
        return;
      }

      // Get user location and add markers
      this.mapService.getUserLocation(
        // Success callback
        (position) => this.handleGeolocationSuccess(position),
        // Error callback
        () => this.mapService.useDefaultLocation(),
      );

      // Trigger change detection
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error initializing Leaflet:', error);
      this.handleLeafletLoadError(retryCount);
    }
  }

  private handleLeafletLoadError(retryCount: number): void {
    if (retryCount < 3) {
      // Maximum 3 retry attempts
      console.log(`Retrying Leaflet initialization (${retryCount + 1}/3)...`);
      // Wait a bit longer on each retry
      setTimeout(
        () => {
          // Try to reload Leaflet using the MapService
          this.mapService.reloadLeaflet('map').then(() => {
            // After reloading, try to initialize the map again
            this.initializeMap(retryCount + 1);
          });
        },
        1000 * (retryCount + 1),
      ); // Increasing delay: 1s, 2s, 3s
    } else {
      console.error('Failed to initialize Leaflet after multiple attempts');
    }
  }

  private handleGeolocationSuccess(position: GeolocationPosition): void {
    if (!this.map) return;

    const { latitude, longitude } = position.coords;

    // Update location info
    this.updateLocationInfo(
      this.translate.instant('location.your_location'),
      this.translate.instant('location.current_position'),
      [
        {
          label: this.translate.instant('location.details.latitude'),
          value: latitude.toFixed(6),
        },
        {
          label: this.translate.instant('location.details.longitude'),
          value: longitude.toFixed(6),
        },
      ],
      this.translate.instant('location.current_location_description'),
    );

    // Add random markers around user location using the MapService
    this.mapService.addRandomMarkers(
      ['Park', 'Cafe', 'Museum', 'Library', 'Market'],
      5,
      (name, type, lat, lng) => {
        // Update location info when marker is clicked
        this.updateLocationInfo(
          name,
          this.translate.instant('location.near_your_location'),
          [
            {
              label: this.translate.instant('location.details.type'),
              value: type,
            },
            {
              label: this.translate.instant('location.details.latitude'),
              value: lat.toFixed(6),
            },
            {
              label: this.translate.instant('location.details.longitude'),
              value: lng.toFixed(6),
            },
          ],
          `A ${type.toLowerCase()} located near your position.`,
        );
      },
    );
    // Trigger change detection
    this.cdr.markForCheck();
  }

  // Helper method to update location info in the bottom-sheet
  private updateLocationInfo(
    name: string,
    region: string,
    details: { label: string; value: string }[],
    description: string,
  ): void {
    // Update signals with new values
    this.locationName.set(name);
    this.locationRegion.set(region);
    this.locationDetails.set(details);
    this.locationDescription.set(description);

    // Update map URL if lat/lng are available
    const latValue = details.find(
      (d) => d.label === this.translate.instant('location.details.latitude'),
    )?.value;
    const lngValue = details.find(
      (d) => d.label === this.translate.instant('location.details.longitude'),
    )?.value;

    if (latValue && lngValue) {
      this.mapUrl.set(`https://www.google.com/maps?q=${latValue},${lngValue}`);
    }

    // Set default website URL
    this.websiteUrl.set('https://www.openstreetmap.org/about');
  }

  protected onScroll({ clientHeight, scrollTop }: HTMLElement): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const offset = Number.parseInt(this.stops[0], 10);
    const top = Math.min(scrollTop, clientHeight - offset);
    const transform = `translate3d(0, ${-top}px, 0)`;

    if (this.button?.nativeElement) {
      this.button.nativeElement.style.setProperty('transform', transform);
    }
  }
}
