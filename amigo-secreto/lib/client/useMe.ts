"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, type ApiResult } from "./api";

export type Wish = { title: string; price: number; link: string | null; details: string | null };

export type Me = {
  user: { id: string; name: string; isOrganizer: boolean };
  group: { name: string; eventDate: string | null; priceCap: number; drawDone: boolean; inviteCode: string };
  salt: string;
  wrappedPrivateKey: string;
  wrapIv: string;
  wishes: Wish[];
};

/** Loads the signed-in person. If there is no session it sends them to the sign-in screen. */
export function useMe() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(
    (r: ApiResult<Me>) => {
      if (r.ok) {
        setMe(r.data);
        setError(null);
      } else if (r.status === 401) {
        router.replace("/entrar");
      } else {
        setError(r.error);
      }
    },
    [router],
  );

  const reload = useCallback(async () => apply(await apiFetch<Me>("/api/me")), [apply]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Me>("/api/me").then((r) => {
      if (!cancelled) apply(r);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  return { me, error, reload };
}
