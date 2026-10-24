import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ContextoSesion {
  // Resolve once per window. Going fullscreen in a browser tab must not switch accounts.
  readonly channel: 'web' | 'pwa' =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    ['standalone', 'minimal-ui', 'window-controls-overlay'].some(
      (mode) => window.matchMedia?.(`(display-mode: ${mode})`).matches,
    )
      ? 'pwa'
      : 'web';

  key(name: string): string {
    // Existing shared sessions and pending operations remain accessible in the web.
    // Never import those credentials into the installed application.
    return this.channel === 'pwa' ? `vesta_pwa:${name}` : name;
  }
}
