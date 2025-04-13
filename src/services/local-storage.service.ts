import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class LocalStorageService {
  private readonly isBrowser: boolean;
  private readonly memoryStorage = new Map<string, string>();

  constructor() {
    this.isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  }

  /**
   * Gets an item from localStorage (browser) or memory storage (server)
   * @param key The key to get
   * @returns The value or null if not found
   */
  getItem(key: string): string | null {
    if (this.isBrowser) {
      return localStorage.getItem(key);
    }
    return this.memoryStorage.get(key) || null;
  }

  /**
   * Sets an item in localStorage (browser) or memory storage (server)
   * @param key The key to set
   * @param value The value to set
   */
  setItem(key: string, value: string): void {
    if (this.isBrowser) {
      localStorage.setItem(key, value);
    } else {
      this.memoryStorage.set(key, value);
    }
  }

  /**
   * Removes an item from localStorage (browser) or memory storage (server)
   * @param key The key to remove
   */
  removeItem(key: string): void {
    if (this.isBrowser) {
      localStorage.removeItem(key);
    } else {
      this.memoryStorage.delete(key);
    }
  }

  /**
   * Clears all items from localStorage (browser) or memory storage (server)
   */
  clear(): void {
    if (this.isBrowser) {
      localStorage.clear();
    } else {
      this.memoryStorage.clear();
    }
  }
}
