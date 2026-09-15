/**
 * Hands bytes to the browser as a download, to the user's own filesystem.
 *
 * The one way a file leaves this application: an object URL on an anchor, clicked,
 * revoked. Not a network destination — the file goes to the device, and what the user
 * does with it afterwards is their action (ADR-0009). Used by the audit-log CSV and the
 * briefing PDF.
 */

export function downloadBytes(
  bytes: BlobPart,
  filename: string,
  mediaType: string,
): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: mediaType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** A file-safe slug of a name: letters, digits, and hyphens, lower case. */
export function slugOf(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled"
  );
}
