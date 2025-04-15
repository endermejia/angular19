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
    // Only load Leaflet in browser environment
    if (isPlatformBrowser(platformId)) {
      this.leafletLoadPromise = this.loadLeaflet();
    }
  }

  /**
   * Returns a promise that resolves when Leaflet is loaded
   * @param forceReload If true, forces a new load of Leaflet even if it's already loaded
   */
  public getLeaflet(forceReload: boolean = false): Promise<typeof L | null> {
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
    try {
      this.loadAttempts++;
      console.log(`Loading Leaflet dynamically (attempt ${this.loadAttempts}/${this.MAX_LOAD_ATTEMPTS})...`);

      // Add a small delay before loading to ensure the browser is ready
      if (this.loadAttempts > 1) {
        await new Promise(resolve => setTimeout(resolve, 500 * this.loadAttempts));
      }

      // Dynamically import Leaflet only in browser environment
      const leaflet = await import('leaflet');

      console.log('Leaflet imported successfully, checking if Map constructor is available...');

      // Verify that the Map constructor is available
      if (!leaflet.Map) {
        console.error('Leaflet loaded but Map constructor is not available');

        // If we haven't reached the maximum number of attempts, try again
        if (this.loadAttempts < this.MAX_LOAD_ATTEMPTS) {
          console.log(`Retrying Leaflet load (${this.loadAttempts}/${this.MAX_LOAD_ATTEMPTS})...`);
          return this.loadLeaflet();
        }

        return null;
      }

      console.log('Leaflet Map constructor is available');

      // Ensure CSS is loaded
      if (typeof document !== 'undefined') {
        // Check if Leaflet CSS is already loaded
        if (!document.getElementById('leaflet-css')) {
          console.log('Adding Leaflet CSS to document head');
          const link = document.createElement('link');
          link.id = 'leaflet-css';
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
          link.crossOrigin = '';
          document.head.appendChild(link);
        }
      }

      // Add a small delay to ensure everything is properly initialized
      await new Promise(resolve => setTimeout(resolve, 100));

      // Double-check that Map constructor is still available
      if (!leaflet.Map) {
        console.error('Map constructor disappeared after loading');

        // If we haven't reached the maximum number of attempts, try again
        if (this.loadAttempts < this.MAX_LOAD_ATTEMPTS) {
          return this.loadLeaflet();
        }

        return null;
      }

      this.L = leaflet;
      return leaflet;
    } catch (error) {
      console.error('Error loading Leaflet:', error);

      // If we haven't reached the maximum number of attempts, try again
      if (this.loadAttempts < this.MAX_LOAD_ATTEMPTS) {
        console.log(`Retrying after error (${this.loadAttempts}/${this.MAX_LOAD_ATTEMPTS})...`);
        return this.loadLeaflet();
      }

      return null;
    }
  }
}
