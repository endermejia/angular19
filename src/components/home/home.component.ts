import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
  PLATFORM_ID,
  ChangeDetectorRef,
  signal,
  WritableSignal,
  AfterViewInit,
  NgZone,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TuiBottomSheet } from '@taiga-ui/addon-mobile';
import { TuiButton, TuiTitle } from '@taiga-ui/core';
import { TuiHeader } from '@taiga-ui/layout';
import { TranslateService } from '@ngx-translate/core';
// Import types only, not the actual library
import type * as L from 'leaflet';

@Component({
  selector: 'app-home',
  imports: [TuiBottomSheet, TuiButton, TuiTitle, TuiHeader],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex grow',
  },
})
export class HomeComponent implements OnInit, AfterViewInit {
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
    'https://www.openstreetmap.org/',
  );
  protected websiteUrl: WritableSignal<string> = signal('');

  private map?: L.Map;
  private markers: L.Marker[] = [];
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly ngZone = inject(NgZone);
  // Property to store the dynamically imported Leaflet instance
  private L: typeof import('leaflet') | null = null;

  ngOnInit(): void {
    // Only initialize the map in the browser environment
    if (isPlatformBrowser(this.platformId)) {
      // Dynamically import Leaflet only in browser
      import('leaflet')
        .then((L) => {
          // Store Leaflet instance for use in other methods
          this.L = L;
          this.fixLeafletIconPaths();
        })
        .catch((error) => {
          console.error('Error loading Leaflet library:', error);
          // Show a user-friendly error message
          this.locationDescription.set(
            this.translate.instant('location.error.map_load_failed') ||
            'Failed to load map. Please refresh the page and try again.'
          );
        });
    }
  }

  ngAfterViewInit(): void {
    // Initialize the map after the view is initialized
    if (isPlatformBrowser(this.platformId) && this.L) {
      this.initMap();
    } else if (isPlatformBrowser(this.platformId)) {
      // If Leaflet is not loaded yet, wait for it
      const checkLeaflet = () => {
        if (this.L) {
          this.initMap();
        } else {
          requestAnimationFrame(checkLeaflet);
        }
      };
      requestAnimationFrame(checkLeaflet);
    }
  }

  private fixLeafletIconPaths(): void {
    if (!this.L) return;

    // Fix Leaflet's default icon paths using CDN URLs
    const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
    const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
    const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

    // @ts-ignore - Leaflet's typings don't include this property
    delete this.L.Icon.Default.prototype._getIconUrl;

    this.L.Icon.Default.mergeOptions({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
    });
  }

  private initMap(): void {
    if (!this.L) return;

    // Create the map instance with a temporary default view
    // We'll update it with the user's location as soon as it's available
    this.map = this.L.map('map').setView([0, 0], 2); // World view initially

    // Add the OpenStreetMap tiles
    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    // Try to get user's current location first
    // The addRandomMarkers will be called after we get the user's location
    this.getUserLocation();
  }

  private getUserLocation(): void {
    if (!this.L) return;

    if (navigator.geolocation) {
      // Show a message to the user explaining why we need location access
      if (this.map && this.L) {
        const locationMessage = this.L.popup()
          .setLatLng(this.map.getCenter())
          .setContent(
            `
            <div class="text-center p-4">
              <h3 class="text-lg font-semibold mb-2">${this.translate.instant('location.permission.title')}</h3>
              <p class="mb-2">${this.translate.instant('location.permission.message')}</p>
              <p class="mb-4">${this.translate.instant('location.permission.allow')}</p>
              <button id="retry-location" class="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded cursor-pointer">
                ${this.translate.instant('location.permission.button')}
              </button>
            </div>
          `,
          )
          .openOn(this.map);

        // Add event listener to the retry button using MutationObserver
        this.addEventListenerToPopupButton('retry-location', () => {
          locationMessage.close();
          this.requestGeolocation();
        });
      }

      this.requestGeolocation();
    } else {
      console.error('Geolocation is not supported by this browser.');
      this.showGeolocationError(
        this.translate.instant('location.error.unsupported.title'),
        this.translate.instant('location.error.unsupported.message'),
      );

      // If geolocation is not supported, fall back to a default location
      if (this.map) {
        this.map.setView([51.505, -0.09], 13);
        this.addRandomMarkers();
      }
    }
  }

  private requestGeolocation(): void {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        if (this.map && this.L) {
          // Set the map view to the user's location
          this.map.setView([latitude, longitude], 13);

          // Update the bottom-sheet with user location info
          this.locationName.set(this.translate.instant('location.your_location'));
          this.locationRegion.set(this.translate.instant('location.current_position'));
          this.locationDetails.set([
            { label: this.translate.instant('location.details.latitude'), value: latitude.toFixed(6) },
            { label: this.translate.instant('location.details.longitude'), value: longitude.toFixed(6) },
          ]);
          this.locationDescription.set(
            this.translate.instant('location.current_location_description'),
          );

          // Update map URL to point to the user's location
          this.mapUrl.set(
            `https://www.openstreetmap.org/#map=15/${latitude.toFixed(6)}/${longitude.toFixed(6)}`,
          );
          this.websiteUrl.set('https://www.openstreetmap.org/about');

          // Add a marker at the user's location
          const userMarker = this.L.marker([latitude, longitude])
            .addTo(this.map)
            .bindPopup(this.translate.instant('location.your_current_location'))
            .openPopup();

          // Add click handler to user marker
          userMarker.on('click', () => {
            this.updateLocationInfo(
              this.translate.instant('location.your_location'),
              this.translate.instant('location.current_position'),
              [
                { label: this.translate.instant('location.details.latitude'), value: latitude.toFixed(6) },
                { label: this.translate.instant('location.details.longitude'), value: longitude.toFixed(6) },
              ],
              this.translate.instant('location.current_location_description'),
            );
          });

          // Now add random markers around the user's location
          this.addRandomMarkers();
        }
      },
      (error) => {
        console.error('Error getting user location:', error);

        let errorMessage = '';
        let errorDetails = '';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = this.translate.instant(
              'location.error.denied.title',
            );
            errorDetails = this.translate.instant(
              'location.error.denied.message',
            );
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = this.translate.instant(
              'location.error.unavailable.title',
            );
            errorDetails = this.translate.instant(
              'location.error.unavailable.message',
            );
            break;
          case error.TIMEOUT:
            errorMessage = this.translate.instant(
              'location.error.timeout.title',
            );
            errorDetails = this.translate.instant(
              'location.error.timeout.message',
            );
            break;
          default:
            errorMessage = this.translate.instant(
              'location.error.unknown.title',
            );
            errorDetails = this.translate.instant(
              'location.error.unknown.message',
            );
        }

        this.showGeolocationError(errorMessage, errorDetails);

        // If we can't get the user's location, fall back to a default location (e.g., London)
        if (this.map) {
          this.map.setView([51.505, -0.09], 13);
          this.addRandomMarkers();
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  }

  private showGeolocationError(title: string, message: string): void {
    if (this.map && this.L) {
      const errorPopup = this.L.popup()
        .setLatLng(this.map.getCenter())
        .setContent(
          `
          <div class="text-center p-4">
            <h3 class="text-lg font-semibold mb-2">${title}</h3>
            <p class="mb-4">${message}</p>
            <button id="retry-location" class="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded cursor-pointer">
              ${this.translate.instant('location.retry')}
            </button>
          </div>
        `,
        )
        .openOn(this.map);

      // Add event listener to the retry button using MutationObserver
      this.addEventListenerToPopupButton('retry-location', () => {
        errorPopup.close();
        this.requestGeolocation();
      });
    }
  }

  // Helper method to add event listeners to dynamically created buttons
  private addEventListenerToPopupButton(
    buttonId: string,
    callback: () => void,
  ): void {
    // First try to get the button directly
    const button = document.getElementById(buttonId);
    if (button) {
      this.ngZone.runOutsideAngular(() => {
        button.addEventListener('click', () => {
          this.ngZone.run(() => callback());
        });
      });
      return;
    }

    // If button is not found, use MutationObserver to wait for it
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          const button = document.getElementById(buttonId);
          if (button) {
            this.ngZone.runOutsideAngular(() => {
              button.addEventListener('click', () => {
                this.ngZone.run(() => callback());
              });
            });
            observer.disconnect();
            break;
          }
        }
      }
    });

    // Start observing the document body for DOM changes
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Helper method to update location info in the bottom-sheet
  private updateLocationInfo(
    name: string,
    region: string,
    details: { label: string; value: string }[],
    description: string,
  ): void {
    this.locationName.set(name);
    this.locationRegion.set(region);
    this.locationDetails.set(details);
    this.locationDescription.set(description);

    // Update map URL to point to the location
    const latLabel = this.translate.instant('location.details.latitude');
    const lngLabel = this.translate.instant('location.details.longitude');
    const latValue = details.find((d) => d.label === latLabel)?.value;
    const lngValue = details.find((d) => d.label === lngLabel)?.value;
    if (latValue && lngValue) {
      this.mapUrl.set(
        `https://www.openstreetmap.org/#map=15/${latValue}/${lngValue}`,
      );
    }

    // Update website URL based on location type
    const typeLabel = this.translate.instant('location.details.type');
    const locationType =
      details.find((d) => d.label === typeLabel)?.value.toLowerCase() || '';

    const parkType = this.translate.instant('location.type.park').toLowerCase();
    const cafeType = this.translate.instant('location.type.cafe').toLowerCase();
    const museumType = this.translate.instant('location.type.museum').toLowerCase();
    const libraryType = this.translate.instant('location.type.library').toLowerCase();
    const marketType = this.translate.instant('location.type.market').toLowerCase();

    switch (locationType) {
      case parkType:
        this.websiteUrl.set('https://www.nationaltrust.org.uk/visit/parks');
        break;
      case cafeType:
        this.websiteUrl.set('https://www.tripadvisor.com/Restaurants');
        break;
      case museumType:
        this.websiteUrl.set('https://www.museumsassociation.org');
        break;
      case libraryType:
        this.websiteUrl.set('https://www.gov.uk/local-library-services');
        break;
      case marketType:
        this.websiteUrl.set(
          'https://www.visitbritainshop.com/world/articles/best-markets-in-britain/',
        );
        break;
      default:
        // For user location or unknown types
        this.websiteUrl.set('https://www.openstreetmap.org/about');
        break;
    }

    // No need to call detectChanges() as signals automatically trigger change detection
  }

  private addRandomMarkers(): void {
    if (!this.map || !this.L) return;

    // Clear existing markers
    this.markers.forEach((marker) => marker.remove());
    this.markers = [];

    // Add 5 random markers around the current map center
    const center = this.map.getCenter();
    const lat = center.lat;
    const lng = center.lng;

    // Location names and types for random markers
    const locationTypes = [
      {
        name: this.translate.instant('location.type.park'),
        details: [
          this.translate.instant('location.feature.park.1'),
          this.translate.instant('location.feature.park.2'),
          this.translate.instant('location.feature.park.3')
        ]
      },
      {
        name: this.translate.instant('location.type.cafe'),
        details: [
          this.translate.instant('location.feature.cafe.1'),
          this.translate.instant('location.feature.cafe.2'),
          this.translate.instant('location.feature.cafe.3')
        ]
      },
      {
        name: this.translate.instant('location.type.museum'),
        details: [
          this.translate.instant('location.feature.museum.1'),
          this.translate.instant('location.feature.museum.2'),
          this.translate.instant('location.feature.museum.3')
        ]
      },
      {
        name: this.translate.instant('location.type.library'),
        details: [
          this.translate.instant('location.feature.library.1'),
          this.translate.instant('location.feature.library.2'),
          this.translate.instant('location.feature.library.3')
        ]
      },
      {
        name: this.translate.instant('location.type.market'),
        details: [
          this.translate.instant('location.feature.market.1'),
          this.translate.instant('location.feature.market.2'),
          this.translate.instant('location.feature.market.3')
        ]
      },
    ];

    for (let i = 0; i < 5; i++) {
      // Generate random offsets (within ~2km)
      const latOffset = (Math.random() - 0.5) * 0.04;
      const lngOffset = (Math.random() - 0.5) * 0.04;

      const markerLat = lat + latOffset;
      const markerLng = lng + lngOffset;

      // Get a random location type
      const locationType = locationTypes[i];
      const markerName = `${locationType.name} ${i + 1}`;

      // Create marker details
      const details = [
        { label: this.translate.instant('location.details.type'), value: locationType.name },
        { label: this.translate.instant('location.details.latitude'), value: markerLat.toFixed(6) },
        { label: this.translate.instant('location.details.longitude'), value: markerLng.toFixed(6) },
        { label: this.translate.instant('location.details.features'), value: locationType.details.join(', ') },
      ];

      // Create description
      const distance = (Math.random() * 2).toFixed(1);
      const description = this.translate.instant(
        'location.description',
        [locationType.name.toLowerCase(), distance, locationType.name, locationType.details[0].toLowerCase()]
      );

      const marker = this.L.marker([markerLat, markerLng])
        .addTo(this.map)
        .bindPopup(markerName);

      // Add click handler to update bottom-sheet content
      marker.on('click', () => {
        this.updateLocationInfo(
          markerName,
          this.translate.instant('location.near_your_location'),
          details,
          description,
        );
      });

      this.markers.push(marker);
    }
  }

  protected onScroll({ clientHeight, scrollTop }: HTMLElement): void {
    const offset = Number.parseInt(this.stops[0], 10);
    const top = Math.min(scrollTop, clientHeight - offset);
    const transform = `translate3d(0, ${-top}px, 0)`;

    if (this.button?.nativeElement) {
      this.button.nativeElement.style.setProperty('transform', transform);
    }
  }
}
