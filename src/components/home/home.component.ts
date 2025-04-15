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
import { TuiButton, TuiTitle } from '@taiga-ui/core';
import { TuiHeader } from '@taiga-ui/layout';
import { TranslateService } from '@ngx-translate/core';
import { MapService } from '../../services';
// Import types only, not the actual library
import type * as L from 'leaflet';

@Component({
  selector: 'app-home',
  imports: [TuiBottomSheet, TuiButton, TuiTitle, TuiHeader],
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
      return;
    }

    // Initialize the map
    this.initializeMap();
  }

  private initializeMap(): void {
    // Only proceed in browser environment
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Use the Promise-based API to wait for Leaflet to load
    this.mapService
      .getLeaflet()
      .then((leaflet) => {
        if (!leaflet) {
          return;
        }

        // Initialize the map
        this.initMap();

        // Trigger change detection
        this.cdr.markForCheck();
      })
      .catch((error) => {
        console.error('Error loading Leaflet:', error);
      });
  }

  private setupLeafletIcons(): void {
    if (!this.L || !isPlatformBrowser(this.platformId)) return;

    try {
      // Use Leaflet's built-in icons by setting the imagePath to the CDN
      if (this.L.Icon && this.L.Icon.Default) {
        // Set the path to the icons folder on the CDN
        // This matches the same CDN where the CSS is loaded from
        this.L.Icon.Default.imagePath = 'https://unpkg.com/leaflet@1.9.4/dist/images/';

        // Create a new instance of the default icon to ensure it's properly initialized
        const defaultIcon = new this.L.Icon.Default();

        // Set as default icon for markers
        if (this.L.Marker && this.L.Marker.prototype) {
          this.L.Marker.prototype.options =
            this.L.Marker.prototype.options || {};
          this.L.Marker.prototype.options.icon = defaultIcon;
        }
      }
    } catch (error) {
      console.error('Error setting up Leaflet icons:', error);
    }
  }

  private initMap(): void {
    if (!this.L) return;

    try {
      // Ensure the map container exists
      const mapContainer = document.getElementById('map');
      if (!mapContainer) {
        console.error('Map container not found');
        return;
      }

      // Set up icons
      this.setupLeafletIcons();

      // Create the map with a default world view
      this.map = new this.L.Map('map').setView([0, 0], 2);

      // Add the OpenStreetMap tiles
      this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(this.map);

      // Get user location and add markers
      this.getUserLocation();
    } catch (error) {
      console.error('Error initializing map:', error);
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
    const userMarker = this.L.marker([latitude, longitude])
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
      this.mapUrl.set(
        `https://www.google.com/maps?q=${latValue},${lngValue}`,
      );
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
