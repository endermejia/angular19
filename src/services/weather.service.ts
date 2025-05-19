import {
  Injectable,
  PLATFORM_ID,
  inject,
  signal,
  WritableSignal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';

// Define interfaces for the weather data
export interface WeatherLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface WeatherData {
  location: WeatherLocation;
  temperature: number;
  description: string;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  date: string;
  icon: string;
  forecast?: WeatherForecast[];
}

export interface WeatherForecast {
  date: string;
  temperature: {
    min: number;
    max: number;
  };
  description: string;
  icon: string;
}

// Interfaces for Open-Meteo API
interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  current_weather: {
    temperature: number;
    windspeed: number;
    winddirection: number;
    weathercode: number;
    time: string;
  };
  daily: {
    time: string[];
    weathercode: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    windspeed_10m_max: number[];
  };
  hourly: {
    time: string[];
    relativehumidity_2m: number[];
    precipitation: number[];
  };
}

@Injectable({
  providedIn: 'root',
})
export class WeatherService {
  private readonly isBrowser: boolean;
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  // Base URL for Open-Meteo API
  private readonly OPEN_METEO_API_URL =
    'https://api.open-meteo.com/v1/forecast';

  // Cache for weather data
  private weatherCache = new Map<string, WeatherData>();

  // Signal for current weather data
  public currentWeather: WritableSignal<WeatherData | null> = signal(null);

  constructor() {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }


  /**
   * Gets weather data for a specific location
   * @param location The weather location
   * @returns An observable of weather data
   */
  public getWeatherForLocation(
    location: WeatherLocation,
  ): Observable<WeatherData | null> {
    // Check if we're in a browser environment
    if (!this.isBrowser) {
      return of(null);
    }

    // Check if we have cached data
    const cacheKey = `${location.id}`;
    if (this.weatherCache.has(cacheKey)) {
      const cachedData = this.weatherCache.get(cacheKey)!;
      this.currentWeather.set(cachedData);
      return of(cachedData);
    }

    // Call the Open-Meteo API to get weather data
    return this.getOpenMeteoWeatherData(location).pipe(
      tap((data) => {
        if (data) {
          this.weatherCache.set(cacheKey, data);
          this.currentWeather.set(data);
        }
      }),
      catchError((error) => {
        console.error('Error fetching weather data:', error);
        return of(null);
      }),
    );
  }

  /**
   * Gets weather data from the Open-Meteo API
   * @param location The weather location
   * @returns An observable of weather data
   */
  private getOpenMeteoWeatherData(
    location: WeatherLocation,
  ): Observable<WeatherData> {
    // Build the URL with query parameters
    const params = {
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
      current_weather: 'true',
      timezone: 'Europe/Madrid',
      daily:
        'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,windspeed_10m_max',
      hourly: 'relativehumidity_2m,precipitation',
    };

    // Convert a params object to URL query string
    const queryParams = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    // Make the API request
    return this.http
      .get<OpenMeteoResponse>(`${this.OPEN_METEO_API_URL}?${queryParams}`)
      .pipe(
        map((response) => {
          // Get the current hour index
          const now = new Date();
          const currentHourIndex = response.hourly.time.findIndex(
            (time) =>
              new Date(time).getHours() === now.getHours() &&
              new Date(time).getDate() === now.getDate(),
          );

          // Get the current humidity and precipitation
          const humidity =
            currentHourIndex >= 0
              ? response.hourly.relativehumidity_2m[currentHourIndex]
              : 0;
          const precipitation =
            currentHourIndex >= 0
              ? response.hourly.precipitation[currentHourIndex]
              : 0;

          // Map the response to our WeatherData interface
          const weatherData: WeatherData = {
            location,
            temperature: response.current_weather.temperature,
            description: this.getWeatherDescription(
              response.current_weather.weathercode,
            ),
            humidity,
            windSpeed: response.current_weather.windspeed,
            precipitation,
            date: response.current_weather.time,
            icon: this.getWeatherIcon(
              this.getWeatherDescription(response.current_weather.weathercode),
            ),
            forecast: this.mapOpenMeteoForecast(response),
          };

          return weatherData;
        }),
      );
  }

  /**
   * Maps the Open-Meteo forecast data to our WeatherForecast interface
   * @param response The Open-Meteo API response
   * @returns An array of weather forecasts
   */
  private mapOpenMeteoForecast(response: OpenMeteoResponse): WeatherForecast[] {
    const forecast: WeatherForecast[] = [];

    // Skip today (index 0) and get the next 5 days
    for (let i = 1; i < Math.min(6, response.daily.time.length); i++) {
      const description = this.getWeatherDescription(
        response.daily.weathercode[i],
      );

      forecast.push({
        date: response.daily.time[i],
        temperature: {
          min: response.daily.temperature_2m_min[i],
          max: response.daily.temperature_2m_max[i],
        },
        description,
        icon: this.getWeatherIcon(description),
      });
    }

    return forecast;
  }

  /**
   * Gets a weather description based on the Open-Meteo weather code
   * @param weatherCode The Open-Meteo weather code
   * @returns A weather description
   */
  private getWeatherDescription(weatherCode: number): string {
    // Weather codes from Open-Meteo documentation
    // https://open-meteo.com/en/docs
    switch (weatherCode) {
      case 0:
        return 'Soleado';
      case 1:
      case 2:
        return 'Parcialmente nublado';
      case 3:
        return 'Nublado';
      case 45:
      case 48:
        return 'Niebla';
      case 51:
      case 53:
      case 55:
        return 'Llovizna';
      case 61:
      case 63:
        return 'Lluvia ligera';
      case 65:
        return 'Lluvia intensa';
      case 71:
      case 73:
      case 75:
        return 'Nieve';
      case 80:
      case 81:
      case 82:
        return 'Lluvia intensa';
      case 95:
      case 96:
      case 99:
        return 'Tormenta';
      default:
        return 'Desconocido';
    }
  }

  /**
   * Gets a weather icon based on the description
   * @param description The weather description
   * @returns The icon name
   */
  private getWeatherIcon(description: string): string {
    switch (description) {
      case 'Soleado':
        return 'sun';
      case 'Parcialmente nublado':
        return 'cloud-sun';
      case 'Nublado':
        return 'cloud';
      case 'Niebla':
        return 'foggy';
      case 'Llovizna':
        return 'cloud-sun-rain';
      case 'Lluvia ligera':
        return 'cloud-rain';
      case 'Lluvia intensa':
        return 'cloud-showers-heavy';
      case 'Tormenta':
        return 'bolt';
      case 'Nieve':
        return 'snowflake';
      default:
        return 'question';
    }
  }
}
