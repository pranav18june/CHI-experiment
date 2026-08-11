import telemetry, { createParticipantId, EventType } from './telemetry.js'

export { createParticipantId }

/**
 * Backward compatibility wrapper delegating to the telemetry service.
 */
export async function recordStudyEvent(event) {
  telemetry.recordEvent(event.type || EventType.SCREEN_VIEWED, event.payload || event, {
    participantId: event.participantId,
    condition: event.condition,
    participantType: event.participantType,
    trialId: event.trial || event.trialId,
    screen: event.screen,
  })
}
