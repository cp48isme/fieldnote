"use client";

/**
 * The pre-event email: what the representative enters for it, and the button that
 * composes one draft per recipient. Plan §3.3, ADR-0011.
 *
 * Reached from the event switcher's list, the pattern of sessions 8 through 11. One
 * screen, sections in the order the email will have them: the location — address,
 * coordinates, and the site map; the logistics she types; the library's passages as a
 * checklist; the recipients; then Compose.
 *
 * COMPOSE WRITES DRAFTS, NOT AN EMAIL. Each recipient gets a `DraftRecord` of kind
 * `pre-event` beside its audit record, under the same gate as a follow-up: opened to be
 * reviewed, copied to her mail client to be exported. Nothing is sent from here, and no
 * model is called — the composer is a pure function over records, and the one network
 * call in this application is not on this screen.
 *
 * THE SITE MAP CANNOT RIDE THE CLIPBOARD. It is stored as bytes with the event, drawn
 * into the briefing, and downloaded from here as a file so she can attach it in Mail
 * beside the email; the email says "Site map attached." only while one is stored.
 *
 * THE FORWARDABLE BLOCK (ADR-0002) is session 14's, behind a flag. The composer has a
 * place for it and nothing else does.
 */

import { useEffect, useMemo, useState } from "react";

import {
  createDraftWithAudit,
  getImage,
  listApprovedContent,
  putImage,
  removeImage,
  updateEventDossier,
  updateEventLocation,
  type ApprovedContentRecord,
  type AttendeeRecord,
  type EventRecord,
  type Id,
  type ImageRecord,
} from "@/lib/db";
import { downloadBytes, slugOf } from "@/lib/download";
import { canvasSurface } from "@/lib/images/canvas-surface";
import { dataUrlOf } from "@/lib/images/data-url";
import { PhotoError, resizeSiteMap } from "@/lib/images/resize";
import { parseCoordinates } from "@/lib/location/coordinates";
import { appleMapsLink, googleMapsLink } from "@/lib/location/map-links";
import { composePreEvent } from "@/lib/preevent/compose";

type SaveState = "idle" | "saving" | "saved" | "error";

function saveLabel(state: SaveState, dirty: boolean, error: string | null): string {
  if (state === "saving") return "Saving…";
  if (state === "saved") return "Saved";
  if (state === "error") return error ?? "Not saved";
  return dirty ? "Not saved yet" : "";
}

export interface PreEventScreenProps {
  event: EventRecord;
  attendees: AttendeeRecord[];
  /** A field on the event was saved; the caller holds the event. */
  onEventChanged: (event: EventRecord) => void;
  /** Drafts were written; the caller shows the review surface. */
  onComposed: (count: number) => void;
  onClose: () => void;
}

export function PreEventScreen({
  event,
  attendees,
  onEventChanged,
  onComposed,
  onClose,
}: PreEventScreenProps) {
  const [address, setAddress] = useState(event.address);
  const [coordinates, setCoordinates] = useState(event.coordinates);
  const [locationState, setLocationState] = useState<SaveState>("idle");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [siteMap, setSiteMap] = useState<ImageRecord | null>(null);
  const [siteMapBusy, setSiteMapBusy] = useState(false);
  const [siteMapError, setSiteMapError] = useState<string | null>(null);
  const [logistics, setLogistics] = useState(event.logistics);
  const [logisticsState, setLogisticsState] = useState<SaveState>("idle");
  const [library, setLibrary] = useState<ApprovedContentRecord[]>([]);
  const [selectedPassages, setSelectedPassages] = useState<Set<Id>>(new Set());
  const [recipients, setRecipients] = useState<Set<Id>>(
    new Set(attendees.map((a) => a.id)),
  );
  const [composing, setComposing] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  useEffect(() => {
    setAddress(event.address);
    setCoordinates(event.coordinates);
    setLogistics(event.logistics);
  }, [event]);

  useEffect(() => {
    let cancelled = false;
    void getImage(event.id, "site-map").then((stored) => {
      if (!cancelled) setSiteMap(stored ?? null);
    });
    void listApprovedContent().then((loaded) => {
      if (!cancelled) setLibrary(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [event.id]);

  useEffect(() => {
    setRecipients(new Set(attendees.map((a) => a.id)));
  }, [attendees]);

  const parsed = useMemo(() => parseCoordinates(coordinates), [coordinates]);
  const siteMapUrl = useMemo(
    () => (siteMap ? dataUrlOf(siteMap.bytes, siteMap.mediaType) : null),
    [siteMap],
  );
  const locationDirty = address !== event.address || coordinates !== event.coordinates;
  const logisticsDirty = logistics !== event.logistics;

  const saveLocation = async () => {
    setLocationState("saving");
    setLocationError(null);
    try {
      onEventChanged(await updateEventLocation(event.id, { address, coordinates }));
      setLocationState("saved");
    } catch (cause) {
      setLocationError(cause instanceof Error ? cause.message : String(cause));
      setLocationState("error");
    }
  };

  const saveLogistics = async () => {
    setLogisticsState("saving");
    try {
      onEventChanged(
        await updateEventDossier(event.id, {
          objectives: event.objectives,
          configuration: event.configuration,
          itinerary: event.itinerary,
          logistics,
          contingency: event.contingency,
        }),
      );
      setLogisticsState("saved");
    } catch {
      setLogisticsState("error");
    }
  };

  const uploadSiteMap = async (file: File) => {
    setSiteMapBusy(true);
    setSiteMapError(null);
    try {
      const resized = await resizeSiteMap(file, canvasSurface());
      setSiteMap(await putImage({ ownerId: event.id, purpose: "site-map", ...resized }));
    } catch (cause) {
      setSiteMapError(
        cause instanceof PhotoError || cause instanceof Error
          ? cause.message
          : String(cause),
      );
    } finally {
      setSiteMapBusy(false);
    }
  };

  const downloadSiteMap = () => {
    if (!siteMap) return;
    const extension = siteMap.mediaType === "image/png" ? "png" : "jpg";
    downloadBytes(
      siteMap.bytes,
      `site-map-${slugOf(event.name)}.${extension}`,
      siteMap.mediaType,
    );
  };

  const removeSiteMap = async () => {
    setSiteMapBusy(true);
    try {
      await removeImage(event.id, "site-map");
      setSiteMap(null);
    } finally {
      setSiteMapBusy(false);
    }
  };

  const toggle = (set: Set<Id>, id: Id): Set<Id> => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const compose = async () => {
    setComposing(true);
    setComposeError(null);
    try {
      const chosen = attendees.filter((a) => recipients.has(a.id));
      const outcomes = await composePreEvent({
        event,
        recipients: chosen,
        library,
        selectedPassageIds: library
          .filter((p) => selectedPassages.has(p.id))
          .map((p) => p.id),
        siteMapStored: siteMap !== null,
        calendarAttached: event.startsAt !== null && event.endsAt !== null,
      });
      for (const outcome of outcomes) {
        await createDraftWithAudit({
          eventId: event.id,
          attendeeId: outcome.attendeeId,
          kind: "pre-event",
          body: outcome.body,
          blocked: null,
          flagsFired: outcome.flagsFired,
          model: null,
          promptTemplateVersion: null,
          guardrailRulesetVersion: outcome.guardrailRulesetVersion,
          inputHash: outcome.inputHash,
          outputHash: outcome.outputHash,
          passagesUsed: outcome.passagesUsed,
          libraryVersion: outcome.libraryVersion,
        });
      }
      onComposed(outcomes.length);
    } catch (cause) {
      setComposeError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setComposing(false);
    }
  };

  const sortedAttendees = [...attendees].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );

  return (
    <section
      data-testid="pre-event"
      aria-label="Pre-event email"
      className="flex flex-col gap-5 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Pre-event email</h2>
        <button
          type="button"
          data-testid="pre-event-close"
          onClick={onClose}
          className="min-h-11 rounded-lg border px-4 text-sm"
        >
          Back to notes
        </button>
      </div>

      <p className="text-xs opacity-70">
        One email per person, composed from what you enter here and the passages you
        select. No model writes any of it, and the guardrails read all of it, your own
        words included. Compose writes drafts to the follow-ups list; each is opened,
        reviewed, and copied to your mail client like any other.
      </p>

      {/* 1. Location */}
      <form
        data-testid="pre-event-location"
        className="flex flex-col gap-3"
        onSubmit={(submit) => {
          submit.preventDefault();
          if (locationDirty && locationState !== "saving") void saveLocation();
        }}
      >
        <h3 className="text-sm font-semibold">1. Location</h3>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Address</span>
          <input
            data-testid="pre-event-address"
            value={address}
            onChange={(change) => {
              setLocationState("idle");
              setAddress(change.target.value);
            }}
            autoComplete="off"
            className="min-h-11 rounded-lg border px-3 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Coordinates</span>
          <input
            data-testid="pre-event-coordinates"
            value={coordinates}
            onChange={(change) => {
              setLocationState("idle");
              setCoordinates(change.target.value);
            }}
            placeholder="51.5007, -0.1246"
            autoComplete="off"
            inputMode="decimal"
            className="min-h-11 rounded-lg border px-3 text-base"
          />
          <span className="text-xs opacity-60">
            Latitude, then longitude. These matter more than the address: a truck in a
            parking lot is not at the building&apos;s street address, and the map links
            point here.
          </span>
        </label>
        <div data-testid="pre-event-map-links" className="flex flex-col gap-1 text-xs">
          {parsed ? (
            <>
              <span className="opacity-60">
                As they will appear in the email — text, never fetched:
              </span>
              <span data-testid="pre-event-apple-link" className="break-all">
                Apple Maps: {appleMapsLink(parsed)}
              </span>
              <span data-testid="pre-event-google-link" className="break-all">
                Google Maps: {googleMapsLink(parsed)}
              </span>
            </>
          ) : (
            <span className="opacity-60">
              {coordinates.trim()
                ? "Not a valid pair yet; no links."
                : "No coordinates; the email carries no map links."}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <p data-testid="pre-event-location-state" className="text-xs opacity-60">
            {saveLabel(locationState, locationDirty, locationError)}
          </p>
          <button
            type="submit"
            data-testid="pre-event-location-save"
            disabled={!locationDirty || locationState === "saving"}
            className="min-h-11 rounded-lg border px-4 text-base font-medium disabled:opacity-40"
          >
            Save location
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Site map</span>
          <span className="text-xs opacity-60">
            For the &quot;north lot behind Building C&quot; problem no map app solves. It
            cannot ride the clipboard: download it here and attach it in Mail beside the
            email, which says a map is attached only while one is stored. It goes on the
            briefing too.
          </span>
          <div className="flex items-start gap-3">
            {siteMapUrl && siteMap ? (
              // Local bytes as a data: URL, not a remote image.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                data-testid="pre-event-site-map"
                data-width={siteMap.width}
                data-height={siteMap.height}
                data-media-type={siteMap.mediaType}
                src={siteMapUrl}
                alt="Site map"
                className="max-h-40 max-w-[50%] rounded-lg border border-black/10 object-contain dark:border-white/15"
              />
            ) : (
              <span data-testid="pre-event-site-map-none" className="text-xs opacity-60">
                No site map stored.
              </span>
            )}
            <div className="flex flex-col gap-2">
              <label className="min-h-11 cursor-pointer rounded-lg border px-4 py-2 text-sm">
                {siteMapBusy
                  ? "Working…"
                  : siteMap
                    ? "Replace site map"
                    : "Choose a site map"}
                <input
                  data-testid="pre-event-site-map-input"
                  type="file"
                  accept="image/*"
                  disabled={siteMapBusy}
                  onChange={(change) => {
                    const file = change.target.files?.[0];
                    change.target.value = "";
                    if (file) void uploadSiteMap(file);
                  }}
                  className="sr-only"
                />
              </label>
              {siteMap && (
                <>
                  <button
                    type="button"
                    data-testid="pre-event-site-map-download"
                    onClick={downloadSiteMap}
                    className="min-h-11 rounded-lg border px-4 text-sm"
                  >
                    Download site map
                  </button>
                  <button
                    type="button"
                    data-testid="pre-event-site-map-remove"
                    onClick={() => void removeSiteMap()}
                    disabled={siteMapBusy}
                    className="min-h-11 rounded-lg border px-4 text-sm"
                  >
                    Remove site map
                  </button>
                </>
              )}
            </div>
          </div>
          {siteMapError && (
            <p
              data-testid="pre-event-site-map-error"
              role="alert"
              className="text-sm text-red-600"
            >
              {siteMapError}
            </p>
          )}
        </div>
      </form>

      {/* 2. Logistics */}
      <form
        data-testid="pre-event-logistics"
        className="flex flex-col gap-2"
        onSubmit={(submit) => {
          submit.preventDefault();
          if (logisticsDirty && logisticsState !== "saving") void saveLogistics();
        }}
      >
        <h3 className="text-sm font-semibold">2. Logistics</h3>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">In your words</span>
          <textarea
            data-testid="pre-event-logistics-text"
            value={logistics}
            onChange={(change) => {
              setLogisticsState("idle");
              setLogistics(change.target.value);
            }}
            placeholder="Arrival window, time commitment, what to wear, what to expect."
            className="h-28 w-full resize-none rounded-lg border p-3 text-base leading-relaxed"
          />
          <span className="text-xs opacity-60">
            The same field as the briefing&apos;s logistics. The guardrails read it: a
            claim about the product here is replaced with a gap you will see in review.
          </span>
        </label>
        <div className="flex items-center justify-between gap-3">
          <p data-testid="pre-event-logistics-state" className="text-xs opacity-60">
            {saveLabel(logisticsState, logisticsDirty, null)}
          </p>
          <button
            type="submit"
            data-testid="pre-event-logistics-save"
            disabled={!logisticsDirty || logisticsState === "saving"}
            className="min-h-11 rounded-lg border px-4 text-base font-medium disabled:opacity-40"
          >
            Save logistics
          </button>
        </div>
      </form>

      {/* 3. Product information */}
      <div data-testid="pre-event-passages" className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">3. Product information</h3>
        {library.length === 0 ? (
          <p data-testid="pre-event-passages-empty" className="text-xs opacity-60">
            No approved passages are loaded, so the email will say nothing about the
            product. Passages are loaded under &quot;Approved content…&quot; in the event
            list.
          </p>
        ) : (
          <>
            <p className="text-xs opacity-60">
              Selected passages go in exactly as approved. Nothing else about the product
              can be written here.
            </p>
            <ul className="flex flex-col gap-2">
              {library.map((passage) => (
                <li key={passage.id}>
                  <label className="flex items-start gap-3 rounded-lg border border-black/10 p-3 text-sm dark:border-white/15">
                    <input
                      type="checkbox"
                      data-testid="pre-event-passage"
                      data-passage-id={passage.id}
                      checked={selectedPassages.has(passage.id)}
                      onChange={() =>
                        setSelectedPassages(toggle(selectedPassages, passage.id))
                      }
                      className="mt-1 h-5 w-5"
                    />
                    <span className="flex flex-col gap-1">
                      <span className="font-medium">{passage.label}</span>
                      <span className="whitespace-pre-wrap text-xs opacity-80">
                        {passage.body}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* 4. Recipients */}
      <div data-testid="pre-event-recipients" className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">4. Recipients</h3>
        <p className="text-xs opacity-60">
          Everyone on the event&apos;s list, selected. Untick anyone who should not get
          one.
        </p>
        {sortedAttendees.length === 0 ? (
          <p className="text-sm opacity-60">
            Nobody yet. Add people from the note dock or import a sheet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sortedAttendees.map((attendee) => (
              <li key={attendee.id}>
                <label className="flex min-h-11 items-center gap-3 rounded-lg border border-black/10 px-3 text-sm dark:border-white/15">
                  <input
                    type="checkbox"
                    data-testid="pre-event-recipient"
                    data-attendee-id={attendee.id}
                    checked={recipients.has(attendee.id)}
                    onChange={() => setRecipients(toggle(recipients, attendee.id))}
                    className="h-5 w-5"
                  />
                  <span>{attendee.displayName}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 5. Compose */}
      <div data-testid="pre-event-compose-section" className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">5. Compose</h3>
        <p className="text-xs opacity-60">
          Writes one draft per selected person to the follow-ups list. Open each to review
          it; copy it to your mail client from there. Nothing is sent.
        </p>
        <button
          type="button"
          data-testid="pre-event-compose"
          onClick={() => void compose()}
          disabled={composing || recipients.size === 0}
          className="min-h-11 self-start rounded-lg border px-4 text-base font-medium disabled:opacity-40"
        >
          {composing
            ? "Composing…"
            : `Compose ${recipients.size} draft${recipients.size === 1 ? "" : "s"}`}
        </button>
        {composeError && (
          <p
            data-testid="pre-event-compose-error"
            role="alert"
            className="text-sm text-red-600"
          >
            {composeError}
          </p>
        )}
      </div>
    </section>
  );
}
