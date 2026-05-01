function normalizeIdParam(idParam: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(idParam) ? idParam[0] : idParam;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t.length > 0 ? t : undefined;
}

function decodeURIComponentSafe(seg: string): string {
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

/**
 * Entry id for `app/journal/[id].tsx` (`/journal/:id`). Params can be empty in some Router states;
 * pathname is the fallback.
 */
export function resolveJournalEntryRouteId(
  idParam: string | string[] | undefined,
  pathname: string,
): string | undefined {
  const fromParams = normalizeIdParam(idParam);
  if (fromParams) return fromParams;
  const m = /^\/journal\/([^/]+)\/?$/.exec(pathname);
  const seg = m?.[1];
  if (!seg || seg === "new" || seg === "edit") return undefined;
  return decodeURIComponentSafe(seg);
}

/**
 * Entry id for `app/journal/edit/[id].tsx` (`/journal/edit/:id`).
 */
export function resolveJournalEditRouteId(
  idParam: string | string[] | undefined,
  pathname: string,
): string | undefined {
  const fromParams = normalizeIdParam(idParam);
  if (fromParams) return fromParams;
  const m = /^\/journal\/edit\/([^/]+)\/?/.exec(pathname);
  const seg = m?.[1];
  return seg ? decodeURIComponentSafe(seg) : undefined;
}
