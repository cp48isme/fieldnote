import Link from "next/link";

import { ACCESS_COOKIE_MAX_AGE_SECONDS } from "@/lib/access/key";
import { StorageLine } from "@/components/settings/StorageLine";

/**
 * The settings screen: one field, and the only place the caller key is entered. ADR-0012.
 *
 * A SERVER-RENDERED PAGE WITH PLAIN FORMS, ON PURPOSE. No `use client`, no state, no
 * handler. The forms post to `/api/access` the way a form posted in 1999, and the browser
 * follows the 303 back to the app. That is what keeps the key out of every script-readable
 * place: it exists in the field for as long as it takes to submit, and after that it lives
 * in an `HttpOnly` cookie the page cannot read. Nothing here touches the data layer, so
 * there is no schema field, no migration, and nothing about the key in IndexedDB.
 *
 * WHAT THIS PAGE CANNOT TELL HER. Whether a key is already stored. The cookie is scoped
 * `Path=/api`, so the browser does not send it to this page and this page cannot look.
 * That is the right trade — a cookie scoped to the document as well would be attached to
 * every request for no gain — and it is why the copy below says what entering a key does
 * rather than what the state currently is.
 */

export const dynamic = "force-dynamic";

const DAYS = Math.round(ACCESS_COOKIE_MAX_AGE_SECONDS / 86_400);

export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<{ failed?: string; saved?: string; forgotten?: string }>;
}) {
  const flags = await searchParams;
  const failed = flags.failed === "1";
  const saved = flags.saved === "1";
  const forgotten = flags.forgotten === "1";

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-6 text-sm">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">This device</h1>
        <p className="opacity-70">
          Drafting a follow-up asks this site&apos;s server to call the model. The server
          answers devices that carry the access key and refuses the rest. Enter the key
          once here and this device is remembered for {DAYS} days.
        </p>
      </header>

      {/*
        Each outcome says what happened, because nothing here can check afterwards: the
        cookie is scoped `Path=/api` so the browser never sends it to this page, and a
        saved key used to look exactly like having done nothing (`fieldnote-cno`).
      */}
      {saved && (
        <p
          role="status"
          data-testid="access-saved"
          className="rounded-lg border border-sky-700 bg-sky-500/10 p-4"
        >
          This device is remembered. You can close this screen.{" "}
          <Link href="/" className="underline" data-testid="access-saved-back">
            Back to capture
          </Link>
        </p>
      )}

      {forgotten && (
        <p
          role="status"
          data-testid="access-forgotten"
          className="rounded-lg border border-sky-700 bg-sky-500/10 p-4"
        >
          This device has been forgotten.
        </p>
      )}

      {failed && (
        <p
          role="status"
          data-testid="access-failed"
          className="rounded-lg border border-amber-700 bg-amber-500/10 p-4"
        >
          That key was not recognised. Nothing was saved. Check it and try again.
        </p>
      )}

      <p className="opacity-70" data-testid="access-guidance">
        This screen can&apos;t check later whether a key is saved. If drafting says the
        device isn&apos;t authorised, enter the key again.
      </p>

      <form
        method="POST"
        action="/api/access"
        className="flex flex-col gap-3"
        data-testid="access-form"
      >
        <input type="hidden" name="action" value="save" />
        <label className="flex flex-col gap-2">
          <span className="font-medium">Access key</span>
          <input
            type="password"
            name="key"
            required
            autoComplete="off"
            spellCheck={false}
            data-testid="access-key-input"
            // 16px, so iOS does not zoom the page when this takes focus.
            className="rounded-lg border border-edge bg-transparent p-3 text-base"
          />
        </label>
        <button
          type="submit"
          data-testid="access-save"
          className="self-start rounded-lg border border-edge px-4 py-2 font-medium"
        >
          Remember this device
        </button>
      </form>

      <form method="POST" action="/api/access" className="flex flex-col gap-2">
        <input type="hidden" name="action" value="forget" />
        <button
          type="submit"
          data-testid="access-forget"
          className="self-start rounded-lg border border-edge px-4 py-2"
        >
          Forget this device
        </button>
        <span className="opacity-70">
          Removes the key from this browser. Notes, drafts, and records are untouched.
        </span>
      </form>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Storage</h2>
        <StorageLine />
        <span className="opacity-70">
          Persistent means the browser has agreed not to clear this app&apos;s notes to
          reclaim space. It is not a guarantee, and it is not a backup: what has to
          outlive this device has to leave it.
        </span>
      </section>

      <Link href="/" className="underline" data-testid="access-back">
        Back to capture
      </Link>
    </main>
  );
}
