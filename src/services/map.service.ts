import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
// Import type only, not the actual library
import type * as L from 'leaflet';

@Injectable()
export class MapService {
  public L: typeof L | null = null;
  private leafletLoadPromise: Promise<typeof L | null> | null = null;
  private loadAttempts = 0;
  private readonly MAX_LOAD_ATTEMPTS = 3;
  private map?: L.Map;
  private markers: L.Marker[] = [];

  constructor(@Inject(PLATFORM_ID) private platformId: object) {
    // Don't load Leaflet in the constructor - wait for an explicit request
  }

  /**
   * Returns a promise that resolves when Leaflet is loaded
   * @param forceReload If true, forces a new load of Leaflet even if it's already loaded
   */
  public getLeaflet(forceReload = false): Promise<typeof L | null> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.resolve(null);
    }

    // If forceReload is true, create a new load promise
    if (forceReload) {
      this.L = null; // Reset the current instance
      this.loadAttempts = 0; // Reset load attempts counter
      this.leafletLoadPromise = this.loadLeaflet();
    }

    return this.leafletLoadPromise || Promise.resolve(this.L);
  }

  /**
   * Ensures that Leaflet is fully loaded and the Map constructor is available
   * This method will retry loading Leaflet if necessary
   */
  public async ensureLeafletLoaded(): Promise<typeof L | null> {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    // Try to get Leaflet
    let leaflet = await this.getLeaflet();

    // If Leaflet is not loaded or Map constructor is not available, try to reload
    if (!leaflet || !leaflet.Map) {
      console.warn('Leaflet not properly loaded, attempting to reload...');

      // Reset and try again
      this.L = null;
      this.loadAttempts = 0;
      this.leafletLoadPromise = this.loadLeaflet();

      // Wait for reload
      leaflet = await this.leafletLoadPromise;
    }

    return leaflet;
  }

  /**
   * Sets up Leaflet icons for markers
   */
  public setupLeafletIcons(): void {
    if (!this.L || !isPlatformBrowser(this.platformId)) return;

    try {
      console.log('Setting up Leaflet icons...');

      // Check if window.L is available and use it if it is
      if (typeof window !== 'undefined' && window.L) {
        if (window.L.Icon && typeof window.L.Icon === 'function') {
          console.log('Using Leaflet Icon from window object');
          if (!this.L.Icon) {
            this.L.Icon = window.L.Icon as never;
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

  /**
   * Initializes the map with the given container ID
   * @param containerId The ID of the HTML element to contain the map
   * @returns The created map instance or undefined if initialization failed
   */
  public initMap(containerId = 'map'): L.Map | undefined {
    // Double-check we're in the browser environment
    if (!isPlatformBrowser(this.platformId)) {
      console.log('Not in browser environment, skipping map initialization');
      return undefined;
    }

    if (!this.L) {
      console.error('Leaflet not available in initMap');
      return undefined;
    }

    try {
      // Ensure the map container exists
      const mapContainer = document.getElementById(containerId);
      if (!mapContainer) {
        console.error('Map container not found');
        return undefined;
      }

      // Set up icons
      this.setupLeafletIcons();

      // Triple-check Leaflet.Map is available
      if (!this.L.Map) {
        console.error('Leaflet Map constructor not available in initMap');
        return undefined;
      }

      // Verify that Map is a constructor function
      if (typeof this.L.Map !== 'function') {
        console.error('Leaflet Map is not a constructor function');
        return undefined;
      }

      // Check if window.L is available and use it if it is
      if (
        typeof window !== 'undefined' &&
        window.L &&
        typeof window.L.Map === 'function'
      ) {
        console.log('Using Leaflet from window object');
        this.L = window.L as unknown as typeof import('leaflet');
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
        this.map = new this.L.Map(containerId, {
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

        return this.map;
      } catch (mapError) {
        console.error('Error creating map instance:', mapError);
        return undefined;
      }
    } catch (error) {
      console.error('Error initializing map:', error);
      return undefined;
    }
  }

  /**
   * Gets the user's location and centers the map on it
   * @param onLocationFound Callback function to execute when the location is found
   * @param onLocationError
   */
  public getUserLocation(
    onLocationFound?: (position: GeolocationPosition) => void,
    onLocationError?: () => void,
  ): void {
    if (!this.L || !isPlatformBrowser(this.platformId) || !this.map) return;

    // Check if geolocation is available
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      // Request geolocation
      navigator.geolocation.getCurrentPosition(
        // Success callback
        (position) => {
          const { latitude, longitude } = position.coords;

          // Set map view to user location
          this.map?.setView([latitude, longitude], 13);

          // Add user marker
          if (this.L && this.map) {
            this.L.marker([latitude, longitude])
              .addTo(this.map)
              .bindPopup('Your current location')
              .openPopup();
          }

          // Call the callback if provided
          if (onLocationFound) {
            onLocationFound(position);
          }
        },
        // Error callback
        (error) => {
          console.error('Error getting user location:', error);
          this.useDefaultLocation();
          if (onLocationError) {
            onLocationError();
          }
        },
        // Options
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    } else {
      // Fallback to the default location
      this.useDefaultLocation();
      if (onLocationError) {
        onLocationError();
      }
    }
  }

  /**
   * Sets the map view to a default location (London)
   */
  public useDefaultLocation(): void {
    if (!this.map) return;

    // Use Madrid as default location
    this.map.setView([40.416775, -3.70379], 13);
  }

  /**
   * Adds random markers around the current map center
   * @param locationTypes Array of location types to use for markers
   * @param count Number of markers to add
   * @param onMarkerClick Callback function to execute when a marker is clicked
   */
  public addRandomMarkers(
    locationTypes: string[] = ['Park', 'Cafe', 'Museum', 'Library', 'Market'],
    count = 5,
    onMarkerClick?: (
      name: string,
      type: string,
      lat: number,
      lng: number,
    ) => void,
  ): void {
    if (!this.map || !this.L) return;

    // Clear existing markers
    this.markers.forEach((marker) => marker.remove());
    this.markers = [];

    // Get a map center
    const center = this.map.getCenter();
    const lat = center.lat;
    const lng = center.lng;

    // Add markers
    for (let i = 0; i < count && i < locationTypes.length; i++) {
      // Generate a random position (within ~2km)
      const latOffset = (Math.random() - 0.5) * 0.04;
      const lngOffset = (Math.random() - 0.5) * 0.04;
      const markerLat = lat + latOffset;
      const markerLng = lng + lngOffset;

      // Create a marker name and details
      const locationType = locationTypes[i];
      const markerName = `${locationType} ${i + 1}`;

      // Create and add marker
      const marker = this.L.marker([markerLat, markerLng])
        .addTo(this.map)
        .bindPopup(markerName);

      // Add click handler
      marker.on('click', () => {
        if (onMarkerClick) {
          onMarkerClick(markerName, locationType, markerLat, markerLng);
        }
      });

      this.markers.push(marker);
    }
  }

  /**
   * Reloads Leaflet and reinitializes the map
   * @param containerId The ID of the HTML element to contain the map
   */
  public async reloadLeaflet(containerId = 'map'): Promise<void> {
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

      // Use the enhanced method to ensure Leaflet is fully loaded
      const leaflet = await this.ensureLeafletLoaded();

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
      this.initMap(containerId);
    } catch (error) {
      console.error('Error reloading Leaflet:', error);
    }
  }

  private async loadLeaflet(): Promise<typeof L | null> {
    // Ensure we're in a browser environment
    if (!isPlatformBrowser(this.platformId)) {
      console.log('Not in browser environment, skipping Leaflet load');
      return null;
    }

    try {
      this.loadAttempts++;
      console.log(
        `Loading Leaflet dynamically (attempt ${this.loadAttempts}/${this.MAX_LOAD_ATTEMPTS})...`,
      );

      // Add a small delay before loading to ensure the browser is ready
      if (this.loadAttempts > 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * this.loadAttempts),
        );
      }

      // Make sure Window is defined before trying to load Leaflet
      if (typeof window === 'undefined') {
        console.error('Window is not defined, cannot load Leaflet');
        return null;
      }

      // Check if Leaflet is already available on the window object
      if (window.L && typeof window.L.Map === 'function') {
        console.log('Leaflet already available on window object, using it');
        this.L = window.L as unknown as typeof L;
        return this.L;
      }

      // Dynamically import Leaflet only in the browser environment
      const leaflet = await import('leaflet');

      console.log(
        'Leaflet imported successfully, checking if Map constructor is available...',
      );

      // Verify that the Map constructor is available
      if (!leaflet.Map) {
        console.error('Leaflet loaded but Map constructor is not available');

        // If we haven't reached the maximum number of attempts, try again
        if (this.loadAttempts < this.MAX_LOAD_ATTEMPTS) {
          console.log(
            `Retrying Leaflet load (${this.loadAttempts}/${this.MAX_LOAD_ATTEMPTS})...`,
          );
          return this.loadLeaflet();
        }

        return null;
      }

      console.log('Leaflet Map constructor is available');

      // We don't need to load CSS here as it's already included in index.html and angular.json
      // This avoids potential issues with duplicate CSS loading

      // Add a small delay to ensure everything is properly initialized
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Double-check that Map constructor is still available
      if (!leaflet.Map) {
        console.error('Map constructor disappeared after loading');

        // If we haven't reached the maximum number of attempts, try again
        if (this.loadAttempts < this.MAX_LOAD_ATTEMPTS) {
          return this.loadLeaflet();
        }

        return null;
      }

      // Store Leaflet on Window for potential reuse
      window.L = leaflet as unknown as never;

      this.L = leaflet;
      return leaflet;
    } catch (error) {
      console.error('Error loading Leaflet:', error);

      // If we haven't reached the maximum number of attempts, try again
      if (this.loadAttempts < this.MAX_LOAD_ATTEMPTS) {
        console.log(
          `Retrying after error (${this.loadAttempts}/${this.MAX_LOAD_ATTEMPTS})...`,
        );
        return this.loadLeaflet();
      }

      return null;
    }
  }
}
