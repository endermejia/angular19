import { Inject, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
// Import type only, not the actual library
import type * as L from 'leaflet';
// Define interface for MarkerClusterGroup instead of importing the type
// This avoids the TS2307 error while still providing type safety
interface MarkerClusterGroupInterface {
  addLayer: (layer: L.Layer) => this;
  addLayers: (layers: L.Layer[]) => this;
  removeLayer: (layer: L.Layer) => this;
  removeLayers: (layers: L.Layer[]) => this;
  clearLayers: () => this;
  addTo: (map: L.Map) => this;
}

// Define option interface for MarkerClusterGroup
interface MarkerClusterGroupOptions {
  showCoverageOnHover?: boolean;
  maxClusterRadius?: number;
  spiderfyOnMaxZoom?: boolean;
  disableClusteringAtZoom?: number;
  [key: string]: unknown; // For any other options that might be used
}

// Define interfaces for Overpass API
interface OverpassElement {
  id: number;
  tags?: {
    name?: string;
    place?: string;
    [key: string]: string | undefined;
  };
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
}

interface OverpassResponse {
  elements: OverpassElement[];
  [key: string]: unknown; // For any other properties in the response
}

// Define constructor interface
type MarkerClusterGroupStatic = new (
  options?: MarkerClusterGroupOptions,
) => MarkerClusterGroupInterface;
import { Observable, Subject, debounceTime, of } from 'rxjs';
import {
  WeatherData,
  WeatherLocation,
  WeatherService,
} from './weather.service';

@Injectable()
export class MapService {
  public L: typeof L | null = null;
  private leafletLoadPromise: Promise<typeof L | null> | null = null;
  private loadAttempts = 0;
  private readonly MAX_LOAD_ATTEMPTS = 3;
  private map?: L.Map;
  private markers: L.Marker[] = [];
  private markersLayer?: L.LayerGroup;
  private markerClusterGroup?: MarkerClusterGroupInterface;
  private weatherService = inject(WeatherService);

  // Cache for storing location results
  private locationCache = new Map<string, WeatherLocation[]>();

  // Debouncing for map movement
  private mapMoveSubject = new Subject<{
    north: number;
    south: number;
    east: number;
    west: number;
    isZoomChange: boolean;
  }>();

  // Store the marker click callback
  private markerClickCallback?: (weatherData: WeatherData) => void;

  // Track the current zoom level to detect zoom changes
  private currentZoomLevel?: number;

  // Track locations that already have markers
  private displayedLocationIds = new Set<string>();

  constructor(@Inject(PLATFORM_ID) private platformId: object) {
    // Don't load Leaflet in the constructor - wait for an explicit request

    // Set up debouncing for map movement
    if (isPlatformBrowser(this.platformId)) {
      this.mapMoveSubject
        .pipe(
          debounceTime(500), // 500ms debounce time
        )
        .subscribe(
          (bounds: {
            north: number;
            south: number;
            east: number;
            west: number;
            isZoomChange: boolean;
          }) => {
            // If it's a zoom change, we need to refresh all markers
            // If it's just a pan, we only need to fetch new locations
            if (bounds.isZoomChange) {
              console.log('Zoom change detected, refreshing all markers');
              this.fetchLocationsFromOverpass(bounds).subscribe({
                next: (locations: WeatherLocation[]) => {
                  // Store the result in the cache
                  const cacheKey = this.getBoundsCacheKey(bounds);
                  this.locationCache.set(cacheKey, locations);

                  // Clear all existing markers and add new ones
                  this.clearMarkers(true); // true = clear all markers
                  this.displayedLocationIds.clear();
                  this.addMarkersForLocations(
                    locations,
                    this.markerClickCallback,
                  );
                },
                error: (error: Error) => {
                  console.error('Error fetching locations:', error);
                },
              });
            } else {
              console.log(
                'Pan detected, preserving existing markers and adding new ones',
              );

              // First, clear markers that are no longer in view
              this.clearMarkers(false); // false = only clear out-of-bounds markers

              this.fetchLocationsFromOverpass(bounds).subscribe({
                next: (locations: WeatherLocation[]) => {
                  // Store the result in the cache
                  const cacheKey = this.getBoundsCacheKey(bounds);
                  this.locationCache.set(cacheKey, locations);

                  // Filter out locations that already have markers
                  const newLocations = locations.filter(
                    (location) => !this.displayedLocationIds.has(location.id),
                  );

                  console.log(
                    `Found ${newLocations.length} new locations to add markers for`,
                  );

                  // Add markers only for new locations
                  this.addMarkersForLocations(
                    newLocations,
                    this.markerClickCallback,
                  );
                },
                error: (error: Error) => {
                  console.error('Error fetching locations:', error);
                },
              });
            }
          },
        );
    }
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

        // Create the map centered on Spain
        this.map = new this.L.Map(containerId, {
          // Add explicit options to ensure proper initialization
          zoomControl: true,
          attributionControl: true,
          fadeAnimation: true,
          zoomAnimation: true,
          markerZoomAnimation: true,
        }).setView([40.416775, -3.70379], 6); // Madrid, Spain with zoom level 6 (community level)

        console.log('Map instance created successfully');

        // Add topography tiles without roads
        this.L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
          {
            maxZoom: 19,
            attribution:
              'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community',
          },
        ).addTo(this.map);

        // Initialize a markers layer group and add it to the map
        this.markersLayer = new this.L.LayerGroup();
        this.markersLayer.addTo(this.map);

        // Initialize a marker cluster group (will be loaded dynamically when needed)
        this.initMarkerClusterGroup();

        // Add a 'load' event listener to ensure markers are created once the map is fully loaded
        this.map.on('load', () => {
          console.log('Map fully loaded, adding initial markers');
          this.addWeatherMarkers();
        });

        // Also trigger an initial load of markers after a short delay
        // This ensures markers are displayed even if the 'load' event doesn't fire
        setTimeout(() => {
          if (this.map && this.markersLayer) {
            console.log('Adding initial markers after timeout');
            this.addWeatherMarkers();
          }
        }, 500);

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
   * Sets the map view to a default location (Spain)
   */
  public useDefaultLocation(): void {
    if (!this.map) return;

    // Use Madrid, Spain as the default location with zoom level 6 (community level)
    this.map.setView([40.416775, -3.70379], 6);
  }

  /**
   * Gets weather locations visible in the current viewport
   * @param bounds The bounds of the map
   * @returns An array of weather locations
   */
  public getLocationsByMapBounds(bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
    isZoomChange?: boolean;
  }): Observable<WeatherLocation[]> {
    console.log('Buscando ubicaciones en los límites:', bounds);

    // Ensure isZoomChange is defined
    const boundsWithZoomFlag = {
      ...bounds,
      isZoomChange:
        bounds.isZoomChange !== undefined ? bounds.isZoomChange : false,
    };

    // Trigger the debounced map movement subject
    this.mapMoveSubject.next(boundsWithZoomFlag);

    // Check if we have cached results for these bounds
    const cacheKey = this.getBoundsCacheKey(bounds);
    if (this.locationCache.has(cacheKey)) {
      console.log('Returning cached locations for bounds:', bounds);
      return of(this.locationCache.get(cacheKey) || []);
    }

    // If not in cache, fetch from Overpass API
    return this.fetchLocationsFromOverpass(bounds);
  }

  /**
   * Adds weather markers based on the current map view
   * @param onMarkerClick Callback function to execute when a marker is clicked
   */
  public addWeatherMarkers(
    onMarkerClick?: (weatherData: WeatherData) => void,
  ): void {
    if (!this.map || !this.L || !this.markersLayer) {
      console.log(
        'Cannot add weather markers: map, Leaflet, or markersLayer not available',
      );
      return;
    }

    // Store the current zoom level
    this.currentZoomLevel = this.map.getZoom();

    // Store the callback for later use
    this.markerClickCallback = onMarkerClick;

    // Clear all existing markers
    this.clearMarkers(true); // true = clear all markers
    this.displayedLocationIds.clear();

    // Get the current map bounds (with error handling)
    let bounds;
    try {
      bounds = this.map.getBounds();
      if (!bounds) {
        console.log('Map bounds not available yet, cannot add markers');
        return;
      }
    } catch (error) {
      console.error('Error getting map bounds:', error);
      return;
    }

    // Convert Leaflet bounds to our bound format
    const mapBounds = {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
      isZoomChange: true, // The initial load is treated as a zoom change
    };

    // Get locations based on map bounds
    this.getLocationsByMapBounds(mapBounds).subscribe({
      next: (locations) => {
        if (!locations || locations.length === 0) {
          console.log('No locations found in the current map view');
          return;
        }

        console.log(
          `Found ${locations.length} locations in the current map view`,
        );

        // Add markers for all locations
        this.addMarkersForLocations(locations, onMarkerClick);
      },
      error: (error: Error) => {
        console.error('Error fetching locations:', error);
      },
    });
  }

  /**
   * Adds markers for specific locations
   * @param locations The locations to add markers for
   * @param onMarkerClick Callback function to execute when a marker is clicked
   */
  private addMarkersForLocations(
    locations: WeatherLocation[],
    onMarkerClick?: (weatherData: WeatherData) => void,
  ): void {
    if (!this.map || !this.L || !this.markersLayer) {
      console.log(
        'Cannot add markers: map, Leaflet, or markersLayer not available',
      );
      return;
    }

    // For each location, get weather data and create a marker
    locations.forEach((location: WeatherLocation) => {
      // Skip if we already have a marker for this location
      if (this.displayedLocationIds.has(location.id)) {
        return;
      }

      // Add to displayed locations set
      this.displayedLocationIds.add(location.id);

      this.weatherService.getWeatherForLocation(location).subscribe({
        next: (weatherData: WeatherData | null) => {
          if (!weatherData) return;

          // Create a marker for this location
          this.createWeatherMarker(weatherData, onMarkerClick);
        },
        error: (error: Error) => {
          console.error(`Error fetching weather for ${location.name}:`, error);
          // Remove from displayed locations if we couldn't get weather data
          this.displayedLocationIds.delete(location.id);
        },
      });
    });
  }

  /**
   * Creates a weather marker for the given weather data
   * @param weatherData The weather data for the location
   * @param onMarkerClick Callback function to execute when the marker is clicked
   */
  private createWeatherMarker(
    weatherData: WeatherData,
    onMarkerClick?: (weatherData: WeatherData) => void,
  ): void {
    if (!this.map || !this.L) return;

    try {
      // Create a custom icon based on the weather description
      const icon = this.createWeatherIcon(weatherData.icon);

      // Create the marker
      const marker = new this.L.Marker(
        [weatherData.location.latitude, weatherData.location.longitude],
        { icon },
      );

      // Add a popup with basic weather info
      marker.bindPopup(
        `<b>${weatherData.location.name}</b><br>${weatherData.temperature}°C - ${weatherData.description}`,
      );

      // Add click handler
      if (onMarkerClick) {
        marker.on('click', (): void => {
          onMarkerClick(weatherData);
        });
      }

      // Add the marker to the appropriate layer
      if (this.markerClusterGroup) {
        // Add to a cluster group if available
        this.markerClusterGroup.addLayer(marker);
        console.log(
          `Added marker for ${weatherData.location.name} to cluster group`,
        );
      } else if (this.markersLayer) {
        // Fallback to a regular layer group
        this.markersLayer.addLayer(marker);
        console.log(
          `Added marker for ${weatherData.location.name} to markers layer`,
        );
      }

      // Store the marker in our array for later reference
      this.markers.push(marker);
    } catch (error) {
      console.error('Error creating weather marker:', error);
    }
  }

  /**
   * Updates markers when the map view changes (zoom or pan)
   * @param onMarkerClick Callback function to execute when a marker is clicked
   */
  public updateMarkersOnMapChange(
    onMarkerClick?: (weatherData: WeatherData) => void,
  ): void {
    if (!this.map || !this.L) return;

    // Store the callback for later use
    this.markerClickCallback = onMarkerClick;

    // Initialize the current zoom level if not set
    if (this.currentZoomLevel === undefined) {
      this.currentZoomLevel = this.map.getZoom();
    }

    // Add zoom change event listener
    this.map.on('zoomend', (): void => {
      if (!this.map) return;

      // Get the new zoom level
      const newZoomLevel = this.map.getZoom();

      // Update the current zoom level
      this.currentZoomLevel = newZoomLevel;

      // Get the current map bounds
      const bounds = this.map.getBounds();
      if (!bounds) return;

      // Convert Leaflet bounds to our bound format
      const mapBounds = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
        isZoomChange: true, // Always true for zoomend event
      };

      console.log(`Zoom changed to ${newZoomLevel}, refreshing markers`);

      // Use the debounced subject to trigger the update
      this.mapMoveSubject.next(mapBounds);
    });

    // Add map movement event listener
    this.map.on('moveend', (): void => {
      if (!this.map) return;

      // Skip if this was triggered by a zoom event (zoomend also triggers moveend)
      // We can detect this by checking if the zoom level changed
      const newZoomLevel = this.map.getZoom();
      if (newZoomLevel !== this.currentZoomLevel) {
        // This moveend was triggered by a zoom, so we'll handle it in the zoomend event
        this.currentZoomLevel = newZoomLevel;
        return;
      }

      // Get the current map bounds
      const bounds = this.map.getBounds();
      if (!bounds) return;

      // Convert Leaflet bounds to our bound format
      const mapBounds = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
        isZoomChange: false, // This is just a pan, not zoom
      };

      console.log('Map moved (pan only), preserving existing markers');

      // Use the debounced subject to trigger the update
      this.mapMoveSubject.next(mapBounds);
    });
  }

  /**
   * Creates a custom icon based on the weather
   * @param iconName The name of the weather icon
   * @returns A custom Leaflet icon
   */
  private createWeatherIcon(iconName: string): L.DivIcon {
    if (!this.L) {
      throw new Error('Leaflet not loaded');
    }

    // Map icon names to emoji or simple text representation
    let iconText = '?';
    switch (iconName) {
      case 'sun':
        iconText = '☀️';
        break;
      case 'cloud-sun':
        iconText = '⛅';
        break;
      case 'cloud':
        iconText = '☁️';
        break;
      case 'foggy':
        iconText = '🌁';
        break;
      case 'cloud-sun-rain':
        iconText = '🌦️';
        break;
      case 'cloud-rain':
        iconText = '🌧️';
        break;
      case 'cloud-showers-heavy':
        iconText = '⛈️';
        break;
      case 'bolt':
        iconText = '⚡';
        break;
      case 'snowflake':
        iconText = '❄️';
        break;
      case 'question':
        iconText = '❓';
        break;
    }

    // Define the icon HTML with emoji and shadow
    const iconHtml = `<div style="font-size: 24px; text-align: center; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000; padding: 2px; border-radius: 50%;">${iconText}</div>`;

    // Create a custom divIcon
    return this.L.divIcon({
      html: iconHtml,
      className: 'weather-icon',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  }

  /**
   * Clears all markers from the map
   * @param clearAll If true, clears all markers; if false, only clears markers that are no longer in view
   */
  public clearMarkers(clearAll = true): void {
    if (clearAll) {
      // Clear all markers
      this.markers.forEach((marker: L.Marker) => {
        try {
          marker.remove();
        } catch (e: unknown) {
          console.warn('Error removing marker:', e);
        }
      });
      this.markers = [];

      // Clear the marker layer
      if (this.markersLayer) {
        this.markersLayer.clearLayers();
      }

      // Clear the marker cluster group
      if (this.markerClusterGroup) {
        this.markerClusterGroup.clearLayers();
      }

      // Clear the displayed location IDs
      this.displayedLocationIds.clear();
    } else if (this.map) {
      // Only clear markers that are no longer in view
      try {
        const bounds = this.map.getBounds();
        if (bounds) {
          // Filter markers that are out of bounds
          const markersToRemove: L.Marker[] = [];
          const locationIdsToRemove: string[] = [];

          // Check each marker to see if it's still in bounds
          this.markers.forEach((marker: L.Marker) => {
            const latLng = marker.getLatLng();
            if (!bounds.contains(latLng)) {
              markersToRemove.push(marker);

              // Find the location ID for this marker
              // This is a bit tricky since we don't store the ID with the marker
              // We'll need to extract it from the popup content or other properties
              const popupContent = marker.getPopup()?.getContent();
              if (typeof popupContent === 'string') {
                // Extract location name from popup content
                const match = popupContent.match(/<b>(.*?)<\/b>/);
                if (match && match[1]) {
                  // Find the location ID with this name
                  this.displayedLocationIds.forEach((id) => {
                    // This is a simplistic approach - in a real app, you'd want a more reliable way to link markers to location IDs
                    if (popupContent.includes(id)) {
                      locationIdsToRemove.push(id);
                    }
                  });
                }
              }
            }
          });

          // Remove markers that are out of bounds
          markersToRemove.forEach((marker) => {
            try {
              // Remove from the appropriate layer
              if (this.markerClusterGroup) {
                this.markerClusterGroup.removeLayer(marker);
              } else if (this.markersLayer) {
                this.markersLayer.removeLayer(marker);
              }

              // Remove from our array
              const index = this.markers.indexOf(marker);
              if (index !== -1) {
                this.markers.splice(index, 1);
              }

              // Remove the marker from the map
              marker.remove();
            } catch (e: unknown) {
              console.warn('Error removing out-of-bounds marker:', e);
            }
          });

          // Remove location IDs for markers that were removed
          locationIdsToRemove.forEach((id) => {
            this.displayedLocationIds.delete(id);
          });

          console.log(
            `Removed ${markersToRemove.length} markers that are no longer in view`,
          );
        }
      } catch (error) {
        console.error('Error clearing out-of-bounds markers:', error);
      }
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

  /**
   * Initializes the marker cluster group for clustering markers
   */
  private initMarkerClusterGroup(): void {
    if (!isPlatformBrowser(this.platformId) || !this.map || !this.L) {
      return;
    }

    // In SSR environments, we need to be careful with dynamic imports
    // Use a more SSR-friendly approach by checking for a window first
    if (typeof window !== 'undefined') {
      // We need to avoid direct TypeScript checking of the import
      // Use a workaround to load the module
      try {
        // Check if MarkerClusterGroup is already available on the Leaflet object
        const leafletWithClusters = this.L as typeof L & {
          MarkerClusterGroup: MarkerClusterGroupStatic;
        };

        if (
          leafletWithClusters &&
          typeof leafletWithClusters.MarkerClusterGroup === 'function'
        ) {
          console.log(
            'Creating marker cluster group from existing MarkerClusterGroup',
          );
          this.markerClusterGroup = new leafletWithClusters.MarkerClusterGroup({
            showCoverageOnHover: false,
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            disableClusteringAtZoom: 12, // Disable clustering at high zoom levels
          });

          // Add the cluster group to the map
          if (this.map) {
            this.markerClusterGroup.addTo(this.map);
            console.log('Marker cluster group added to map');
          }
        } else {
          console.warn(
            'L.MarkerClusterGroup is not available, using regular markers',
          );
        }
      } catch (error) {
        console.error('Error initializing marker cluster group:', error);
      }
    }
  }

  /**
   * Creates a cache key from map bounds
   * @param bounds The bounds of the map
   * @returns A string key for caching
   */
  private getBoundsCacheKey(bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }): string {
    // Round to 2 decimal places to create a reasonable cache grid
    return `${bounds.north.toFixed(2)},${bounds.south.toFixed(2)},${bounds.east.toFixed(2)},${bounds.west.toFixed(2)}`;
  }

  /**
   * Fetches locations from Overpass API
   * @param bounds The bounds of the map
   * @returns An Observable of WeatherLocation array
   */
  private fetchLocationsFromOverpass(bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }): Observable<WeatherLocation[]> {
    if (!isPlatformBrowser(this.platformId)) {
      return of([]);
    }

    // Check if we have cached results for these bounds
    const cacheKey = this.getBoundsCacheKey(bounds);
    if (this.locationCache.has(cacheKey)) {
      console.log('Using cached locations for bounds:', bounds);
      return of(this.locationCache.get(cacheKey) || []);
    }

    console.log('Fetching locations from Overpass API for bounds:', bounds);

    return new Observable<WeatherLocation[]>((observer) => {
      // Construct the Overpass API query
      const overpassQuery = `[out:json];
        (
          node["place"~"city|town|suburb"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
        );
        out center;`;

      // Encode the query for URL
      const encodedQuery = encodeURIComponent(overpassQuery);
      const apiUrl = `https://overpass-api.de/api/interpreter?data=${encodedQuery}`;

      // Use fetch API to get the data
      fetch(apiUrl)
        .then((response: Response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.json();
        })
        .then((data: OverpassResponse) => {
          if (!data || !data.elements || !Array.isArray(data.elements)) {
            console.warn('Invalid response from Overpass API:', data);
            observer.next([]);
            observer.complete();
            return;
          }

          // Process the results
          const allLocations: WeatherLocation[] = data.elements
            .filter(
              (element: OverpassElement) =>
                element && element.tags && element.tags.place,
            )
            .map((element: OverpassElement) => ({
              id: element.id.toString(),
              name: element.tags?.name || 'Unknown',
              latitude:
                element.lat || (element.center ? element.center.lat : 0),
              longitude:
                element.lon || (element.center ? element.center.lon : 0),
              place: element.tags?.place || 'unknown',
            }))
            .filter(
              (location: WeatherLocation & { place: string }) =>
                location.latitude !== 0 &&
                location.longitude !== 0 &&
                location.name !== 'Unknown',
            );

          console.log(
            `Found ${allLocations.length} total locations from Overpass API`,
          );

          // Prioritize and limit locations to the most relevant ones
          const MAX_LOCATIONS = 25; // Limit to a reasonable number

          // Define type for locations with place
          type LocationWithPlace = WeatherLocation & { place: string };

          // Group locations by place type
          const cities = allLocations.filter(
            (loc) => (loc as LocationWithPlace).place === 'city',
          );
          const towns = allLocations.filter(
            (loc) => (loc as LocationWithPlace).place === 'town',
          );
          const suburbs = allLocations.filter(
            (loc) => (loc as LocationWithPlace).place === 'suburb',
          );

          // Sort each group by name for consistency
          const sortByName = (a: WeatherLocation, b: WeatherLocation) =>
            a.name.localeCompare(b.name);
          cities.sort(sortByName);
          towns.sort(sortByName);
          suburbs.sort(sortByName);

          // Combine prioritized locations (cities first, then towns, then suburbs)
          const prioritizedLocations: WeatherLocation[] = [
            ...cities,
            ...towns,
            ...suburbs,
          ].slice(0, MAX_LOCATIONS); // Limit to MAX_LOCATIONS

          console.log(
            `Returning ${prioritizedLocations.length} most relevant locations`,
          );
          observer.next(prioritizedLocations);
          observer.complete();
        })
        .catch((error: Error) => {
          console.error('Error fetching from Overpass API:', error);
          observer.error(error);
        });
    });
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
        // Use a more specific type that includes both Leaflet and MarkerClusterGroup
        this.L = window.L as unknown as typeof L & {
          MarkerClusterGroup: MarkerClusterGroupStatic;
        };
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
      // Use a more specific type that includes both Leaflet and MarkerClusterGroup
      window.L = leaflet as unknown as typeof L & {
        MarkerClusterGroup: MarkerClusterGroupStatic;
      };

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
