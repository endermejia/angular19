import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
// Import type only, not the actual library
import type * as L from 'leaflet';

@Injectable()
export class MapService {

  public L: typeof L | null = null;
  private leafletLoadPromise: Promise<typeof L | null> | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    // Only load Leaflet in browser environment
    if (isPlatformBrowser(platformId)) {
      this.leafletLoadPromise = this.loadLeaflet();
    }
  }

  /**
   * Returns a promise that resolves when Leaflet is loaded
   */
  public getLeaflet(): Promise<typeof L | null> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.resolve(null);
    }

    return this.leafletLoadPromise || Promise.resolve(this.L);
  }

  private async loadLeaflet(): Promise<typeof L | null> {
    try {
      // Dynamically import Leaflet only in browser environment
      const leaflet = await import('leaflet');
      this.L = leaflet;
      return leaflet;
    } catch (error) {
      console.error('Error loading Leaflet:', error);
      return null;
    }
  }
}
