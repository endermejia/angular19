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
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TuiBottomSheet } from '@taiga-ui/addon-mobile';
import { TuiButton, TuiTitle } from '@taiga-ui/core';
import { TuiHeader } from '@taiga-ui/layout';
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
export class HomeComponent implements OnInit {
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
  // Property to store the dynamically imported Leaflet instance
  private L: typeof import('leaflet') | null = null;

  ngOnInit(): void {
    // Only initialize the map in the browser environment
    if (isPlatformBrowser(this.platformId)) {
      // Dynamically import Leaflet only in browser
      import('leaflet').then((L) => {
        // Store Leaflet instance for use in other methods
        this.L = L;
        // Use setTimeout to ensure the DOM is ready
        setTimeout(() => {
          this.fixLeafletIconPaths();
          this.initMap();
        });
      });
    }
  }

  private fixLeafletIconPaths(): void {
    if (!this.L) return;

    // Fix Leaflet's default icon paths
    const iconRetinaUrl = 'assets/marker-icon-2x.png';
    const iconUrl = 'assets/marker-icon.png';
    const shadowUrl = 'assets/marker-shadow.png';

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
            <div style="text-align: center; padding: 10px;">
              <h3 style="margin-bottom: 10px;">Permiso de ubicación</h3>
              <p>Esta aplicación necesita acceder a tu ubicación para mostrarte lugares cercanos.</p>
              <p>Por favor, permite el acceso cuando el navegador lo solicite.</p>
              <button id="retry-location" style="
                background-color: #4CAF50;
                border: none;
                color: white;
                padding: 10px 20px;
                text-align: center;
                text-decoration: none;
                display: inline-block;
                font-size: 16px;
                margin: 10px 0;
                cursor: pointer;
                border-radius: 4px;">
                Permitir acceso
              </button>
            </div>
          `,
          )
          .openOn(this.map);

        // Add event listener to the retry button
        setTimeout(() => {
          const retryButton = document.getElementById('retry-location');
          if (retryButton) {
            retryButton.addEventListener('click', () => {
              locationMessage.close();
              this.requestGeolocation();
            });
          }
        }, 100);
      }

      this.requestGeolocation();
    } else {
      console.error('Geolocation is not supported by this browser.');
      this.showGeolocationError(
        'Tu navegador no soporta geolocalización',
        'Esta aplicación necesita acceso a tu ubicación para funcionar correctamente. Por favor, utiliza un navegador moderno que soporte geolocalización.',
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
          this.locationName.set('Your Location');
          this.locationRegion.set('Current Position');
          this.locationDetails.set([
            { label: 'Latitude', value: latitude.toFixed(6) },
            { label: 'Longitude', value: longitude.toFixed(6) },
          ]);
          this.locationDescription.set(
            'This is your current location. Click on markers to see information about other locations.',
          );

          // Update map URL to point to the user's location
          this.mapUrl.set(
            `https://www.openstreetmap.org/#map=15/${latitude.toFixed(6)}/${longitude.toFixed(6)}`,
          );
          this.websiteUrl.set('https://www.openstreetmap.org/about');

          // Add a marker at the user's location
          const userMarker = this.L.marker([latitude, longitude])
            .addTo(this.map)
            .bindPopup('Your current location')
            .openPopup();

          // Add click handler to user marker
          userMarker.on('click', () => {
            this.updateLocationInfo(
              'Your Location',
              'Current Position',
              [
                { label: 'Latitude', value: latitude.toFixed(6) },
                { label: 'Longitude', value: longitude.toFixed(6) },
              ],
              'This is your current location. Click on markers to see information about other locations.',
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
            errorMessage = 'Permiso de ubicación denegado';
            errorDetails =
              'Has denegado el permiso para acceder a tu ubicación. Para utilizar todas las funciones de esta aplicación, por favor permite el acceso a tu ubicación.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Ubicación no disponible';
            errorDetails =
              'La información de tu ubicación no está disponible en este momento. Por favor, inténtalo de nuevo más tarde.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Tiempo de espera agotado';
            errorDetails =
              'La solicitud para obtener tu ubicación ha tardado demasiado tiempo. Por favor, inténtalo de nuevo.';
            break;
          default:
            errorMessage = 'Error desconocido';
            errorDetails =
              'Ha ocurrido un error desconocido al intentar obtener tu ubicación. Por favor, inténtalo de nuevo más tarde.';
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
          <div style="text-align: center; padding: 10px;">
            <h3 style="margin-bottom: 10px;">${title}</h3>
            <p>${message}</p>
            <button id="retry-location" style="
              background-color: #4CAF50;
              border: none;
              color: white;
              padding: 10px 20px;
              text-align: center;
              text-decoration: none;
              display: inline-block;
              font-size: 16px;
              margin: 10px 0;
              cursor: pointer;
              border-radius: 4px;">
              Reintentar
            </button>
          </div>
        `,
        )
        .openOn(this.map);

      // Add event listener to the retry button
      setTimeout(() => {
        const retryButton = document.getElementById('retry-location');
        if (retryButton) {
          retryButton.addEventListener('click', () => {
            errorPopup.close();
            this.requestGeolocation();
          });
        }
      }, 100);
    }
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
    const latValue = details.find((d) => d.label === 'Latitude')?.value;
    const lngValue = details.find((d) => d.label === 'Longitude')?.value;
    if (latValue && lngValue) {
      this.mapUrl.set(
        `https://www.openstreetmap.org/#map=15/${latValue}/${lngValue}`,
      );
    }

    // Update website URL based on location type
    const locationType =
      details.find((d) => d.label === 'Type')?.value.toLowerCase() || '';
    switch (locationType) {
      case 'park':
        this.websiteUrl.set('https://www.nationaltrust.org.uk/visit/parks');
        break;
      case 'cafe':
        this.websiteUrl.set('https://www.tripadvisor.com/Restaurants');
        break;
      case 'museum':
        this.websiteUrl.set('https://www.museumsassociation.org');
        break;
      case 'library':
        this.websiteUrl.set('https://www.gov.uk/local-library-services');
        break;
      case 'market':
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
      { name: 'Park', details: ['Green space', 'Recreation', 'Nature'] },
      { name: 'Cafe', details: ['Coffee', 'Food', 'Meeting place'] },
      { name: 'Museum', details: ['Art', 'History', 'Culture'] },
      { name: 'Library', details: ['Books', 'Study', 'Community'] },
      { name: 'Market', details: ['Shopping', 'Local produce', 'Crafts'] },
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
        { label: 'Type', value: locationType.name },
        { label: 'Latitude', value: markerLat.toFixed(6) },
        { label: 'Longitude', value: markerLng.toFixed(6) },
        { label: 'Features', value: locationType.details.join(', ') },
      ];

      // Create description
      const description = `This is a local ${locationType.name.toLowerCase()} near your location. It's approximately ${(Math.random() * 2).toFixed(1)} km from your current position. ${locationType.name}s are great places to ${locationType.details[0].toLowerCase()}.`;

      const marker = this.L.marker([markerLat, markerLng])
        .addTo(this.map)
        .bindPopup(markerName);

      // Add click handler to update bottom-sheet content
      marker.on('click', () => {
        this.updateLocationInfo(
          markerName,
          'Near your location',
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
      // Ensure the z-index is preserved
      this.button.nativeElement.style.setProperty('z-index', '10000');
    }
  }
}
