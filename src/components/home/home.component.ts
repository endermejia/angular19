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
  private markers: L.Marker[] = [];
  private readonly platformId = inject(PLATFORM_ID);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly mapService = inject(MapService);
  // Property to access the Leaflet instance from the service
  private get L(): typeof import('leaflet') | null {
    return this.mapService.L;
  }

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

      // Initialize the map
      this.initMap();

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
          this.initializeMap(retryCount + 1);
        },
        1000 * (retryCount + 1),
      ); // Increasing delay: 1s, 2s, 3s
    } else {
      console.error('Failed to initialize Leaflet after multiple attempts');
    }
  }

  private setupLeafletIcons(): void {
    if (!this.L || !isPlatformBrowser(this.platformId)) return;

    try {
      console.log('Setting up Leaflet icons...');

      // Check if window.L is available and use it if it is
      if (typeof window !== 'undefined' && window.L) {
        if (window.L.Icon && typeof window.L.Icon === 'function') {
          console.log('Using Leaflet Icon from window object');
          if (!this.L.Icon) {
            this.L.Icon = window.L.Icon as any;
          }
        }
      }

      // First, check if Icon class exists
      if (!this.L.Icon) {
        console.error('Leaflet Icon class not available');
        return;
      }

      // Check if the Default icon class exists
      if (!this.L.Icon.Default) {
        console.warn('Leaflet Icon.Default not available, creating fallback');

        // Create a basic fallback for Icon.Default if it doesn't exist
        this.L.Icon.Default = this.L.Icon.extend({
          options: {
            iconUrl:
              'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            iconRetinaUrl:
              'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            shadowUrl:
              'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            tooltipAnchor: [16, -28],
            shadowSize: [41, 41],
          },
        }) as unknown as typeof this.L.Icon.Default;
      }

      // Set the path to the icons folder on the CDN
      if (this.L.Icon.Default) {
        console.log('Setting Leaflet Icon.Default imagePath');
        this.L.Icon.Default.imagePath =
          'https://unpkg.com/leaflet@1.9.4/dist/images/';

        try {
          // Create a new instance of the default icon to ensure it's properly initialized
          const defaultIcon = new this.L.Icon.Default();
          console.log('Default icon created successfully');

          // Set as the default icon for markers
          if (this.L.Marker && this.L.Marker.prototype) {
            this.L.Marker.prototype.options =
              this.L.Marker.prototype.options || {};
            this.L.Marker.prototype.options.icon = defaultIcon;
            console.log('Default icon set for markers');
          }
        } catch (iconError) {
          console.error('Error creating default icon:', iconError);

          // Fallback to basic marker if default icon creation fails
          if (this.L.Marker && this.L.Marker.prototype) {
            console.log('Using basic marker options as fallback');
            this.L.Marker.prototype.options =
              this.L.Marker.prototype.options || {};
            // Clear any existing icon to use Leaflet's internal fallback
            delete this.L.Marker.prototype.options.icon;
          }
        }
      } else {
        console.error('Failed to create or find Icon.Default class');
      }
    } catch (error) {
      console.error('Error setting up Leaflet icons:', error);
    }
  }

  private initMap(): void {
    // Double-check we're in browser environment
    if (!isPlatformBrowser(this.platformId)) {
      console.log('Not in browser environment, skipping map initialization');
      return;
    }

    if (!this.L) {
      console.error('Leaflet not available in initMap');
      return;
    }

    try {
      // Ensure the map container exists
      const mapContainer = document.getElementById('map');
      if (!mapContainer) {
        console.error('Map container not found');
        return;
      }

      // Set up icons
      this.setupLeafletIcons();

      // Triple-check Leaflet.Map is available
      if (!this.L.Map) {
        console.error('Leaflet Map constructor not available in initMap');
        // Try to reload Leaflet
        this.reloadLeaflet();
        return;
      }

      // Verify that Map is a constructor function
      if (typeof this.L.Map !== 'function') {
        console.error('Leaflet Map is not a constructor function');
        // Try to reload Leaflet
        this.reloadLeaflet();
        return;
      }

      // Check if window.L is available and use it if it is
      if (
        typeof window !== 'undefined' &&
        window.L &&
        typeof window.L.Map === 'function'
      ) {
        console.log('Using Leaflet from window object');
        this.mapService.L = window.L as unknown as typeof import('leaflet');
      }

      console.log('Creating map instance...');

      try {
        // Clear any existing map instance
        if (this.map) {
          try {
            this.map.remove();
          } catch (e) {
            console.error('Error removing existing map:', e);
          }
          this.map = undefined;
        }

        // Create the map with a default world view
        this.map = new this.L.Map('map', {
          // Add explicit options to ensure proper initialization
          zoomControl: true,
          attributionControl: true,
          fadeAnimation: true,
          zoomAnimation: true,
          markerZoomAnimation: true,
        }).setView([0, 0], 2);

        console.log('Map instance created successfully');

        // Add the OpenStreetMap tiles
        this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors',
        }).addTo(this.map);

        // Get user location and add markers
        this.getUserLocation();

        // Trigger change detection
        this.cdr.markForCheck();
      } catch (mapError) {
        console.error('Error creating map instance:', mapError);

        // Try one more approach - create with a delay and use window.L if available
        setTimeout(() => {
          try {
            // Check if we're still in browser environment
            if (!isPlatformBrowser(this.platformId)) return;

            // Check if map container still exists
            const mapContainer = document.getElementById('map');
            if (!mapContainer) {
              console.error('Map container not found after delay');
              return;
            }

            // Use window.L if available
            if (
              typeof window !== 'undefined' &&
              window.L &&
              typeof window.L.Map === 'function'
            ) {
              console.log('Using Leaflet from window object after delay');
              this.mapService.L =
                window.L as unknown as typeof import('leaflet');
            }

            if (!this.L || !this.L.Map) {
              console.error('Leaflet not available after delay');
              return;
            }

            // Clear any existing map instance
            if (this.map) {
              try {
                this.map.remove();
              } catch (e) {
                console.error('Error removing existing map:', e);
              }
              this.map = undefined;
            }

            console.log('Attempting to create map after delay...');
            this.map = new this.L.Map('map', {
              // Add explicit options to ensure proper initialization
              zoomControl: true,
              attributionControl: true,
              fadeAnimation: true,
              zoomAnimation: true,
              markerZoomAnimation: true,
            }).setView([0, 0], 2);

            // Add the OpenStreetMap tiles
            this.L.tileLayer(
              'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
              {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors',
              },
            ).addTo(this.map);

            // Get user location and add markers
            this.getUserLocation();

            this.cdr.markForCheck();
          } catch (delayedError) {
            console.error('Error creating map after delay:', delayedError);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error initializing map:', error);
      // Try to reload Leaflet on error
      this.reloadLeaflet();
    }
  }

  private getUserLocation(): void {
    if (!this.L || !isPlatformBrowser(this.platformId)) return;

    // Check if geolocation is available
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      // Request geolocation
      navigator.geolocation.getCurrentPosition(
        // Success callback
        (position) => this.handleGeolocationSuccess(position),
        // Error callback
        (error) => this.handleGeolocationError(error),
        // Options
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    } else {
      // Fallback to default location
      this.useDefaultLocation();
    }
  }

  private handleGeolocationSuccess(position: GeolocationPosition): void {
    if (!this.map || !this.L) return;

    const { latitude, longitude } = position.coords;

    // Set map view to user location
    this.map.setView([latitude, longitude], 13);

    // Add user marker
    this.L.marker([latitude, longitude])
      .addTo(this.map)
      .bindPopup(this.translate.instant('location.your_current_location'))
      .openPopup();

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

    // Add random markers around user location
    this.addRandomMarkers();

    // Trigger change detection
    this.cdr.markForCheck();
  }

  private handleGeolocationError(error: GeolocationPositionError): void {
    console.error('Error getting user location:', error);
    this.useDefaultLocation();
  }

  private async reloadLeaflet(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      console.log('Not in browser environment, skipping Leaflet reload');
      return;
    }

    console.log('Attempting to reload Leaflet...');

    // Reset the map instance
    if (this.map) {
      try {
        this.map.remove();
      } catch (e) {
        console.error('Error removing map:', e);
      }
      this.map = undefined;
    }

    try {
      // Wait a bit before trying again
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Always treat Netlify as a special case
      const isNetlify =
        typeof window !== 'undefined' &&
        (window.location?.hostname?.includes('netlify.app') ||
          document.referrer?.includes('netlify.app'));

      // Check if we're in a CSR environment (like Netlify)
      const isCSR =
        typeof window !== 'undefined' &&
        (window.location?.pathname?.includes('index.csr.html') || isNetlify);

      if (isCSR || isNetlify) {
        console.log(
          'Detected CSR/Netlify environment, using special loading approach',
        );

        // First check if map container exists
        const mapContainer = document.getElementById('map');
        if (!mapContainer) {
          console.error('Map container not found during reload');
          return;
        }

        // In CSR mode, try to use window.L if available
        if (window.L && typeof window.L.Map === 'function') {
          console.log('Using Leaflet from window object in CSR mode');
          this.mapService.L = window.L as unknown as typeof import('leaflet');

          // Initialize map with window.L
          console.log('Reinitializing map with window.L...');
          this.initMap();
          this.cdr.markForCheck();
          return;
        }

        // If window.L is not available, try to load it globally
        try {
          console.log('Attempting to load Leaflet globally in CSR mode');

          // First, add the CSS
          if (!document.querySelector('link[href*="leaflet.css"]')) {
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            cssLink.integrity =
              'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
            cssLink.crossOrigin = '';
            document.head.appendChild(cssLink);
          }

          // Then load the JS
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.integrity =
            'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
          script.crossOrigin = '';
          document.head.appendChild(script);

          // Wait for script to load
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
          });

          // Check if Leaflet is now available on window
          if (window.L && typeof window.L.Map === 'function') {
            console.log('Leaflet loaded globally in CSR mode');
            this.mapService.L = window.L as unknown as typeof import('leaflet');

            // Initialize map with window.L
            console.log('Reinitializing map with globally loaded Leaflet...');
            this.initMap();
            this.cdr.markForCheck();
            return;
          } else {
            console.error(
              'Leaflet loaded but Map constructor not available on window.L',
            );
          }
        } catch (scriptError) {
          console.error('Error loading Leaflet script globally:', scriptError);
        }
      }

      // Standard approach for non-CSR environments
      // Use the enhanced method to ensure Leaflet is fully loaded
      const leaflet = await this.mapService.ensureLeafletLoaded();

      if (!leaflet) {
        console.error('Failed to reload Leaflet after multiple attempts');
        return;
      }

      // Double-check Map constructor is available
      if (!leaflet.Map) {
        console.error('Leaflet Map constructor not available after reloading');
        return;
      }

      console.log('Leaflet reloaded successfully, reinitializing map...');
      this.initMap();
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error reloading Leaflet:', error);
    }
  }

  private useDefaultLocation(): void {
    if (!this.map) return;

    // Use London as default location
    this.map.setView([51.505, -0.09], 13);
    this.addRandomMarkers();
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

  private addRandomMarkers(): void {
    if (!this.map || !this.L) return;

    // Clear existing markers
    this.markers.forEach((marker) => marker.remove());
    this.markers = [];

    // Get map center
    const center = this.map.getCenter();
    const lat = center.lat;
    const lng = center.lng;

    // Simple location types
    const locationTypes = ['Park', 'Cafe', 'Museum', 'Library', 'Market'];

    // Add markers
    for (let i = 0; i < 5; i++) {
      // Generate random position (within ~2km)
      const latOffset = (Math.random() - 0.5) * 0.04;
      const lngOffset = (Math.random() - 0.5) * 0.04;
      const markerLat = lat + latOffset;
      const markerLng = lng + lngOffset;

      // Create marker name and details
      const locationType = locationTypes[i];
      const markerName = `${locationType} ${i + 1}`;

      // Create marker details
      const details = [
        {
          label: this.translate.instant('location.details.type'),
          value: locationType,
        },
        {
          label: this.translate.instant('location.details.latitude'),
          value: markerLat.toFixed(6),
        },
        {
          label: this.translate.instant('location.details.longitude'),
          value: markerLng.toFixed(6),
        },
      ];

      // Create and add marker
      const marker = this.L.marker([markerLat, markerLng])
        .addTo(this.map)
        .bindPopup(markerName);

      // Add click handler
      marker.on('click', () => {
        this.updateLocationInfo(
          markerName,
          this.translate.instant('location.near_your_location'),
          details,
          `A ${locationType.toLowerCase()} located near your position.`,
        );
      });

      this.markers.push(marker);
    }

    // Trigger change detection
    this.cdr.markForCheck();
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
