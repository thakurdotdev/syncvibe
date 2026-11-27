import type { Request, Response } from 'express';

/** At most this many reports per request, and this much text per field. */
const MAX_REPORTS = 5;
const MAX_TEXT = 6000;

const text = (value: unknown, max = MAX_TEXT) =>
  typeof value === 'string' ? value.slice(0, max) : undefined;

/**
 * How the app last closed when it wasn't asked to: Android's own exit record (a crash, a native
 * crash, an ANR, a low-memory kill) and any fatal JS error, sent on the next launch. Written to
 * the server log as one JSON line each (`[app-crash]`), so a crash nobody can reproduce still
 * leaves its reason behind. Nothing is stored.
 */
export const reportCrash = (req: Request, res: Response): void => {
  const reports = Array.isArray(req.body?.reports) ? req.body.reports.slice(0, MAX_REPORTS) : [];
  for (const report of reports) {
    console.error(
      '[app-crash]',
      JSON.stringify({
        user: req.user?.userid,
        version: text(req.body?.version, 20),
        kind: text(report?.kind, 20),
        reason: text(report?.reason, 40),
        description: text(report?.description, 500),
        at: typeof report?.at === 'number' ? new Date(report.at).toISOString() : undefined,
        message: text(report?.message, 1000),
        trace: text(report?.trace),
      })
    );
  }
  res.status(204).end();
};
