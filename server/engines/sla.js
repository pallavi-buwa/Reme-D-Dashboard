/**
 * SLA computation engine.
 *
 * Response SLA  — time from creation to first assignment (assigned_to set).
 * Resolution SLA — time from creation to Resolved / Closed status.
 *
 * Returns status: 'met' | 'ok' | 'breached'
 *   met     — condition already satisfied
 *   ok      — not yet satisfied but within the window
 *   breached — window elapsed without satisfaction
 */

const TERMINAL_STATUSES = new Set(['Resolved', 'Closed'])

/**
 * @param {object} complaint  — row from complaints table (needs created_at, assigned_to, status)
 * @param {object} config     — { priority, response_hours, resolution_hours, active }
 * @returns {{ response, resolution } | null}
 */
function computeSla(complaint, config) {
  if (!config || !config.active) return null

  const createdMs = new Date(complaint.created_at).getTime()
  const now = Date.now()

  const responseDeadlineMs = createdMs + config.response_hours * 3600 * 1000
  const resolutionDeadlineMs = createdMs + config.resolution_hours * 3600 * 1000

  const isAssigned = !!complaint.assigned_to
  const isResolved = TERMINAL_STATUSES.has(complaint.status)

  const responseStatus = isAssigned ? 'met'
    : now > responseDeadlineMs ? 'breached'
    : 'ok'

  const resolutionStatus = isResolved ? 'met'
    : now > resolutionDeadlineMs ? 'breached'
    : 'ok'

  return {
    response: {
      target_hours: config.response_hours,
      deadline: new Date(responseDeadlineMs).toISOString(),
      status: responseStatus,
      remaining_mins: Math.round((responseDeadlineMs - now) / 60000),
    },
    resolution: {
      target_hours: config.resolution_hours,
      deadline: new Date(resolutionDeadlineMs).toISOString(),
      status: resolutionStatus,
      remaining_mins: Math.round((resolutionDeadlineMs - now) / 60000),
    },
    breached: responseStatus === 'breached' || resolutionStatus === 'breached',
  }
}

/**
 * Build a lookup map from an array of sla_configs rows.
 * @param {object[]} rows
 * @returns {Record<string, object>}
 */
function buildSlaMap(rows) {
  return Object.fromEntries(rows.map(r => [r.priority, r]))
}

module.exports = { computeSla, buildSlaMap }
