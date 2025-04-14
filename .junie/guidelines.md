# Project Guidelines

## Angular 19 Application

This project is built with Angular 19 and has the following key characteristics:

### Server-Side Rendering (SSR)
- The application uses Angular's Server-Side Rendering
- All browser-specific code must be wrapped with `isPlatformBrowser(this.platformId)` checks
- Avoid direct access to `window`, `document`, `navigator`, or other browser-specific APIs without proper checks
- For browser-specific APIs, also check if they exist: `typeof window !== 'undefined'`, `typeof document !== 'undefined'`, etc.
- Use dynamic imports for browser-only libraries

### Zoneless
- The application is configured to run without Zone.js
- Use the `.zoneless` suffix for event bindings in templates
- Manually handle change detection when needed
- Use signals for reactive state management

### Modern Angular Syntax
- Use the new control flow syntax:
  - `@if` instead of `*ngIf`
  - `@for` instead of `*ngFor`
  - `@switch` and `@case` instead of `*ngSwitch` and `*ngSwitchCase`
  - `@empty` and `@defer` where appropriate
- Use signals for reactive state management
- Use functional guards and resolvers

## Project Structure
- `/src/components` - Application components
- `/src/services` - Application services
- `/src/app` - Core application files
- `/public` - Static assets and i18n files

## Development Guidelines
- Always ensure code works in both browser and server environments
- Test SSR functionality locally before submitting changes
- Use signals for state management
- Follow Angular's style guide for naming conventions and code organization
