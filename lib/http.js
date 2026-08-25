/**
 * Shared HTTP concerns for the study API: CORS, admin auth, and payload limits.
 *
 * These were previously duplicated per handler with permissive defaults —
 * `Access-Control-Allow-Origin: *` on every endpoint, an admin secret that fell
 * back to the literal string "study-admin", and an unbounded ingest body.
 */

/**
 * Origins allowed to call the API. Set STUDY_ALLOWED_ORIGINS to a comma-separated
 * list (e.g. "https://study.example.org"). When unset, same-origin requests still
 * work — the browser only needs CORS headers for cross-origin calls, and the
 * deployed app is served from the same origin as /api.
 */
function allowedOrigins() {
  return (process.env.STUDY_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

/**
 * Applies CORS headers. Returns true if the request was a preflight and has
 * already been answered.
 */
export function applyCors(req, res, { methods = 'GET,OPTIONS,POST' } = {}) {
  const origins = allowedOrigins()
  const requestOrigin = req.headers?.origin

  if (origins.length === 0) {
    // No allow-list configured: same-origin only. No ACAO header is emitted, so
    // a cross-origin read is refused by the browser rather than silently allowed.
  } else if (requestOrigin && origins.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }

  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-Type, Date, X-Api-Version, x-admin-secret'
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return true
  }
  return false
}

/**
 * Admin authentication. Fails closed: with no ADMIN_SECRET configured the
 * endpoint is unavailable rather than protected by a well-known default.
 *
 * The secret is accepted from the x-admin-secret header only — query strings end
 * up in access logs, browser history, and referrer headers.
 *
 * Returns true if the request has been rejected and the handler should stop.
 */
export function rejectUnauthorizedAdmin(req, res) {
  const secret = process.env.ADMIN_SECRET
  if (!secret || secret.length < 16) {
    console.error('[admin] ADMIN_SECRET is unset or too short (<16 chars) — refusing admin access')
    res.status(503).json({
      error: 'Admin API not configured',
      detail: 'Set a strong ADMIN_SECRET (16+ characters) in the deployment environment.',
    })
    return true
  }

  const provided = req.headers?.['x-admin-secret']
  if (!provided || !safeEqual(String(provided), secret)) {
    res.status(401).json({ error: 'Unauthorized' })
    return true
  }
  return false
}

/** Length-independent comparison, so a wrong secret does not leak its length by timing. */
function safeEqual(a, b) {
  const len = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return diff === 0
}

// ── Ingest limits ────────────────────────────────────────────────────────────
// The client batches at most 40 envelopes; the cap is set above that so a normal
// flush is never rejected, while an unbounded or malicious body is.
export const MAX_EVENTS_PER_REQUEST = Number(process.env.MAX_EVENTS_PER_REQUEST || 100)
export const MAX_EVENT_PAYLOAD_BYTES = Number(process.env.MAX_EVENT_PAYLOAD_BYTES || 512 * 1024)

/**
 * Validates an ingest batch's size before any database work.
 * Returns null when acceptable, or an { status, body } rejection.
 */
export function checkIngestLimits(events) {
  if (!Array.isArray(events)) return null
  if (events.length > MAX_EVENTS_PER_REQUEST) {
    return {
      status: 413,
      body: {
        error: 'Batch too large',
        detail: `Received ${events.length} events; maximum is ${MAX_EVENTS_PER_REQUEST}.`,
      },
    }
  }
  let bytes = 0
  try {
    bytes = Buffer.byteLength(JSON.stringify(events))
  } catch {
    return { status: 400, body: { error: 'Unserializable payload' } }
  }
  if (bytes > MAX_EVENT_PAYLOAD_BYTES) {
    return {
      status: 413,
      body: {
        error: 'Payload too large',
        detail: `Received ${bytes} bytes; maximum is ${MAX_EVENT_PAYLOAD_BYTES}.`,
      },
    }
  }
  return null
}
