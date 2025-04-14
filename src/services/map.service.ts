import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
// Import type only, not the actual library
import type * as L from 'leaflet';

@Injectable()
export class MapService {

  public L: typeof L | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    // Only load Leaflet in browser environment
    if (isPlatformBrowser(platformId)) {
      this.loadLeaflet();
    }
  }

  private async loadLeaflet(): Promise<void> {
    try {
      // Dynamically import Leaflet only in browser environment
      const leaflet = await import('leaflet');
      this.L = leaflet;
    } catch (error) {
      console.error('Error loading Leaflet:', error);
    }
  }
}
