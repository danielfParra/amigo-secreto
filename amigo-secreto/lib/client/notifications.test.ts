import { describe, test, expect, beforeEach, vi, afterEach } from "vitest";
import { clearNotifiedIds, describeUnread, notifyIfNewMessages } from "./notifications";

function makeMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

describe("describeUnread", () => {
  test("produces privacy-preserving Spanish summaries for all combinations", () => {
    expect(describeUnread(0, 0)).toBe("");
    expect(describeUnread(0, 1)).toBe("Quien te regala te escribió un mensaje");
    expect(describeUnread(0, 3)).toBe("Quien te regala te escribió 3 mensajes");
    expect(describeUnread(1, 0)).toBe("Tu amigo secreto te respondió en el chat");
    expect(describeUnread(2, 0)).toBe("Tu amigo secreto te escribió 2 mensajes");
    expect(describeUnread(1, 2)).toBe("Tienes 3 mensajes nuevos en el chat anónimo");
  });
});

describe("notifyIfNewMessages", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeMemoryStorage());
    clearNotifiedIds();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("returns true once per new message id and deduplicates repeats", async () => {
    expect(
      await notifyIfNewMessages({
        toCount: 0,
        fromCount: 1,
        latestToId: 0,
        latestFromId: 10,
        sendSystemNotification: false,
      }),
    ).toBe(true);

    // Same id again: should not re-notify.
    expect(
      await notifyIfNewMessages({
        toCount: 0,
        fromCount: 1,
        latestToId: 0,
        latestFromId: 10,
        sendSystemNotification: false,
      }),
    ).toBe(false);

    // A newer message arrives: should notify again.
    expect(
      await notifyIfNewMessages({
        toCount: 0,
        fromCount: 2,
        latestToId: 0,
        latestFromId: 11,
        sendSystemNotification: false,
      }),
    ).toBe(true);
  });

  test("returns false when there are no unread messages", async () => {
    expect(
      await notifyIfNewMessages({
        toCount: 0,
        fromCount: 0,
        latestToId: 0,
        latestFromId: 0,
        sendSystemNotification: false,
      }),
    ).toBe(false);
  });
});
