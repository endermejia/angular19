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

      // Ensure CSS is loaded
      if (typeof document !== 'undefined') {
        // Check if Leaflet CSS is already loaded
        if (!document.getElementById('leaflet-css')) {
          const link = document.createElement('link');
          link.id = 'leaflet-css';
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
          link.crossOrigin = '';
          document.head.appendChild(link);
        }
      }

      this.L = leaflet;
      return leaflet;
    } catch (error) {
      console.error('Error loading Leaflet:', error);
      return null;
    }
  }
}
