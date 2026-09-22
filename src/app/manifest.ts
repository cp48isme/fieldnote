import type { MetadataRoute } from "next";

/**
 * Web app manifest, served at `/manifest.webmanifest`.
 *
 * Per ADR-0001 there is no manufacturer, product, or institution name here, in the icons,
 * or anywhere else in the public build. "Fieldnote" is the project's own name. The
 * private fork carries its own branding as configuration; nothing here is a placeholder
 * waiting to be filled with a real one.
 *
 * `display: "standalone"` because the target is a phone held one-handed at an event —
 * browser chrome costs vertical space that the note textarea needs, especially with the
 * software keyboard covering half the viewport.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fieldnote",
    short_name: "Fieldnote",
    description: "Field capture and follow-up drafting, local to this device.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // One palette, light, always (session 23). Both match `--background` in
    // `globals.css`, so the splash screen and the status bar are the same cream as the
    // page rather than a white flash and a dark bar around it.
    background_color: "#faf6ee",
    theme_color: "#faf6ee",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
