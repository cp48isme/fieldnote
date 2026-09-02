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
    background_color: "#ffffff",
    theme_color: "#1e293b",
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
