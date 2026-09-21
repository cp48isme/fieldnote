/**
 * Asking the browser to keep the store, and reading back what it says.
 *
 * The three cases that matter are the three the application will actually meet: a
 * browser that answers, a browser without the API, and a browser that throws. None of
 * them may reject, because this runs on the start-up path and the capture path is the
 * thing that must not break (`fieldnote-bdw`, ADR-0012).
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PERSISTENCE_WORDING,
  readPersistenceState,
  requestPersistentStorage,
} from "@/lib/storage/persistence";

/** Replaces `navigator.storage` for one test and puts it back afterwards. */
function withStorage(storage: unknown): void {
  Object.defineProperty(globalThis.navigator, "storage", {
    value: storage,
    configurable: true,
  });
}

const original = Object.getOwnPropertyDescriptor(globalThis.navigator, "storage");

afterEach(() => {
  if (original) Object.defineProperty(globalThis.navigator, "storage", original);
});

describe("requestPersistentStorage", () => {
  it("reports persistent when the browser grants it", async () => {
    withStorage({ persist: vi.fn().mockResolvedValue(true) });
    expect(await requestPersistentStorage()).toBe("persistent");
  });

  it("reports not-persistent when the browser refuses", async () => {
    withStorage({ persist: vi.fn().mockResolvedValue(false) });
    expect(await requestPersistentStorage()).toBe("not-persistent");
  });

  it("reports unknown when the API is absent, rather than assuming either answer", async () => {
    withStorage(undefined);
    expect(await requestPersistentStorage()).toBe("unknown");
    withStorage({});
    expect(await requestPersistentStorage()).toBe("unknown");
  });

  it("reports unknown when the call throws, and does not reject", async () => {
    // A private window can throw here. Start-up must survive it.
    withStorage({
      persist: vi.fn().mockRejectedValue(new Error("denied")),
    });
    await expect(requestPersistentStorage()).resolves.toBe("unknown");

    withStorage({
      persist: vi.fn(() => {
        throw new Error("denied synchronously");
      }),
    });
    await expect(requestPersistentStorage()).resolves.toBe("unknown");
  });

  it("asks, rather than only reading", async () => {
    const persist = vi.fn().mockResolvedValue(true);
    withStorage({ persist, persisted: vi.fn().mockResolvedValue(false) });
    await requestPersistentStorage();
    expect(persist).toHaveBeenCalledTimes(1);
  });
});

describe("readPersistenceState", () => {
  it("reads back what the browser reports, without asking it to change", async () => {
    const persist = vi.fn().mockResolvedValue(true);
    withStorage({ persist, persisted: vi.fn().mockResolvedValue(true) });
    expect(await readPersistenceState()).toBe("persistent");
    expect(persist).not.toHaveBeenCalled();
  });

  it("reports not-persistent and unknown the same way the request does", async () => {
    withStorage({ persisted: vi.fn().mockResolvedValue(false) });
    expect(await readPersistenceState()).toBe("not-persistent");
    withStorage({});
    expect(await readPersistenceState()).toBe("unknown");
    withStorage({
      persisted: vi.fn().mockRejectedValue(new Error("no")),
    });
    await expect(readPersistenceState()).resolves.toBe("unknown");
  });
});

describe("the wording", () => {
  it("has one phrase per state and names the state in each", () => {
    expect(PERSISTENCE_WORDING.persistent).toBe("Storage on this device: persistent");
    expect(PERSISTENCE_WORDING["not-persistent"]).toBe(
      "Storage on this device: not persistent",
    );
    expect(PERSISTENCE_WORDING.unknown).toBe("Storage on this device: unknown");
  });
});
