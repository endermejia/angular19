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

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    // Don't load Leaflet in the constructor - wait for explicit request
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

      // Make sure window is defined before trying to load Leaflet
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

      // Dynamically import Leaflet only in browser environment
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

      // Store Leaflet on window for potential reuse
      window.L = leaflet as unknown as any;

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
