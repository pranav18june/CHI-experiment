#!/usr/bin/env node
/**
 * Database index bootstrap (run once per environment, before recruitment).
 *
 * Production sets `autoIndex: false`, so indexes are NOT created implicitly on a
 * cold start. That is deliberate: hundreds of lambdas each attempting index
 * builds during a 500-user burst is wasted work at the worst possible moment.
 *
 * It also makes a silent failure mode visible. TelemetryEvent.eventId is UNIQUE,
 * and that index is what makes the client's retry-the-whole-queue behaviour
 * idempotent. If the collection already holds duplicates, the build fails — and
 * with autoIndex the app would keep running with no de-duplication at all,
 * inflating every per-event aggregate. Here it fails loudly instead.
 *
 *   MONGODB_URI="mongodb+srv://..." node scripts/bootstrap-indexes.js
 */
import mongoose from 'mongoose'

import ModeCounter from '../lib/models/ModeCounter.js'
import ParticipantMode from '../lib/models/ParticipantMode.js'
import ParticipantTrialPlan from '../lib/models/ParticipantTrialPlan.js'
import TelemetryEvent from '../lib/models/TelemetryEvent.js'
import TrialResult from '../lib/models/TrialResult.js'
import PostTaskResponse from '../lib/models/PostTaskResponse.js'

const MODELS = [
  ['ModeCounter', ModeCounter],
  ['ParticipantMode', ParticipantMode],
  ['ParticipantTrialPlan', ParticipantTrialPlan],
  ['TelemetryEvent', TelemetryEvent],
  ['TrialResult', TrialResult],
  ['PostTaskResponse', PostTaskResponse],
]

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI is not set.')
    process.exit(1)
  }

  console.log(`Connecting to ${uri.replace(/\/\/[^@]*@/, '//***@')}`)
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })

  let failed = false

  for (const [name, Model] of MODELS) {
    try {
      await Model.syncIndexes()
      const indexes = await Model.collection.indexes()
      const summary = indexes.map((i) => i.name + (i.unique ? ' (unique)' : '')).join(', ')
      console.log(`  ✓ ${name}: ${summary}`)
    } catch (err) {
      failed = true
      console.error(`  ✗ ${name}: ${err.message}`)
      if (err.code === 11000 || /duplicate key/i.test(err.message)) {
        console.error(
          `    A unique index could not be built because duplicates already exist.\n` +
          `    Resolve them before collecting data — otherwise de-duplication is silently absent.`
        )
      }
    }
  }

  // The one index the ingest path's correctness depends on.
  const eventIndexes = await TelemetryEvent.collection.indexes()
  const uniqueEventId = eventIndexes.find((i) => i.unique && i.key && i.key.eventId === 1)
  if (uniqueEventId) {
    console.log('\n✓ TelemetryEvent.eventId unique index present — retry de-duplication is active.')
  } else {
    failed = true
    console.error('\n✗ TelemetryEvent.eventId unique index MISSING — re-sent batches would duplicate events.')
  }

  await mongoose.disconnect()
  if (failed) process.exit(1)
  console.log('\nIndex bootstrap complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
