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
import { GlobalServiceService, MapService, WeatherData } from '../../services';
// Import types only, not the actual library
import type * as L from 'leaflet';

// Define interface for scroll event target
interface ScrollEventTarget {
  clientHeight: number;
  scrollTop: number;
}

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
  protected locationName: WritableSignal<string> = signal('');
  protected locationDetails: WritableSignal<
    { label: string; value: string }[]
  > = signal([]);
  protected locationDescription: WritableSignal<string> = signal('');
  protected mapUrl: WritableSignal<string> = signal('');
  protected websiteUrl: WritableSignal<string> = signal('');
  protected weatherData: WritableSignal<WeatherData | null> = signal(null);

  // Signal to control the visibility of the bottom-sheet and buttons
  protected showBottomSheet: WritableSignal<boolean> = signal(false);

  private map?: L.Map;
  private readonly platformId = inject(PLATFORM_ID);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly globalService = inject(GlobalServiceService);
  private readonly mapService = inject(MapService);

  ngAfterViewInit(): void {
    // Only proceed in the browser environment
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
    // Only proceed in the browser environment
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

      // Set default location (Spain)
      this.mapService.useDefaultLocation();

      // Add weather markers based on the zoom level
      this.addWeatherMarkers();

      // Set up the map change event handler (zoom and pan)
      this.mapService.updateMarkersOnMapChange((weatherData) =>
        this.handleWeatherMarkerClick(weatherData),
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

  /**
   * Adds weather markers to the map
   */
  private addWeatherMarkers(): void {
    this.mapService.addWeatherMarkers((weatherData) =>
      this.handleWeatherMarkerClick(weatherData),
    );
  }

  /**
   * Handles click events on weather markers
   * @param weatherData The weather data for the clicked location
   */
  private handleWeatherMarkerClick(weatherData: WeatherData): void {
    if (!weatherData) return;

    console.log(
      'Marker clicked, updating bottom-sheet with weather data:',
      weatherData,
    );

    const locationName =
      weatherData.location[`name_${this.globalService.selectedLanguage()}`] ??
      weatherData.location.name;

    console.log(locationName);

    // Update the weatherData signal
    this.weatherData.set(weatherData);

    // Update location info with weather data
    this.updateLocationInfo(
      locationName,
      [
        {
          label: this.translate.instant('location.details.temperature'),
          value: `${weatherData.temperature}°C`,
        },
        {
          label: this.translate.instant('location.details.description'),
          value: weatherData.description,
        },
        {
          label: this.translate.instant('location.details.humidity'),
          value: `${weatherData.humidity}%`,
        },
        {
          label: this.translate.instant('location.details.wind'),
          value: `${weatherData.windSpeed} km/h`,
        },
      ],
      `${weatherData.description} en ${weatherData.location.name} con una temperatura de ${weatherData.temperature}°C.`,
    );

    // Set map URL for Google Maps
    this.mapUrl.set(
      `https://www.google.com/maps/search/?api=1&query=${weatherData.location.latitude},${weatherData.location.longitude}`,
    );

    // Show the bottom-sheet and buttons
    this.showBottomSheet.set(true);

    // Trigger change detection
    this.cdr.markForCheck();
  }

  // Helper method to update location info in the bottom-sheet
  private updateLocationInfo(
    name: string,
    details: { label: string; value: string }[],
    description: string,
  ): void {
    // Update signals with new values
    this.locationName.set(name);
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

  /**
   * Handles the event target from scroll events
   * @param target The event target to be cast to ScrollEventTarget
   * @returns The event target as ScrollEventTarget
   */
  protected handleScrollEvent(target: EventTarget | null): ScrollEventTarget {
    return target as unknown as ScrollEventTarget;
  }

  /**
   * Handles scroll events from the bottom sheet
   * @param target The scroll event target with clientHeight and scrollTop properties
   */
  protected onScroll({ clientHeight, scrollTop }: ScrollEventTarget): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const offset = Number.parseInt(this.stops[0], 10);
    const top = Math.min(scrollTop, clientHeight - offset);
    const transform = `translate3d(0, ${-top}px, 0)`;

    if (this.button?.nativeElement) {
      this.button.nativeElement.style.setProperty('transform', transform);
    }
  }
}
