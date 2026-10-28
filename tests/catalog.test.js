import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { inspectCatalogSource } from '../scripts/catalog-source.mjs'
import { auditedContracts } from '../src/data/contracts.js'
import { inspectCandidate } from '../scripts/catalog-candidate.mjs'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')

test('operational catalog has unique keys and retains every prior effective value', () => {
  const originalBytes = readFileSync(new URL('research/fixed-income/catalog-history/catalog-before-2026-10-27.json', root))
  const decisions = JSON.parse(read('research/fixed-income/catalog-history/deduplication-2026-10-27.json'))
  assert.equal(createHash('sha256').update(originalBytes).digest('hex'), decisions.sourceSha256)
  const original = inspectCatalogSource(originalBytes.toString('utf8'), { rejectDuplicates: false })
  const current = inspectCatalogSource(read('src/data/bondProspectos.json'))
  assert.equal(original.duplicates.length, 5)
  assert.equal(current.duplicates.length, 0)
  assert.deepEqual(current.catalog, original.catalog)
  assert.deepEqual(decisions.decisions.map(decision => decision.key).sort(),
    ['CS51D', 'YM34D', 'YM39D', 'YMCID', 'YMCJD'])
  assert.equal(current.catalog.CS51D.maturity_date, undefined, 'unknown metadata must not be inherited from obsolete duplicate')
  assert.equal(current.catalog.YM34D.callable, undefined, 'stale false call flag must not be inherited')
})

test('source checker detects top-level duplicates without confusing nested keys or escaped text', () => {
  assert.throws(() => inspectCatalogSource('{"A":{},"A":{}}'), /Duplicate catalog keys: A/)
  const result = inspectCatalogSource(JSON.stringify({ A: { A: 1, text: 'a"},:[]' }, B: [{ A: 2 }] }))
  assert.equal(result.duplicates.length, 0)
  assert.equal(result.catalog.B[0].A, 2)
  for (const raw of ['[]', '{"A":{},}', '{"A":{}} trailing', '{"A":"unterminated}']) {
    assert.throws(() => inspectCatalogSource(raw), SyntaxError)
  }
})

test('reviewed YPF contract records original terms without certifying later events or market mappings', () => {
  const contract = auditedContracts.YM34D
  assert.equal(contract.reviewStatus, 'reviewed-original')
  assert.equal(contract.version, '1.1.0')
  assert.deepEqual(contract.paymentConvention.businessDayCenters, ['AR-BANKS', 'US-NY-BANKS'])
  assert.equal(contract.paymentConvention.businessDayAdjustment, null)
  assert.equal(contract.couponDayCount.variant, null)
  assert.equal(contract.isinRegS, 'USP989MJBY67')
  assert.equal(contract.subsequentEventsReviewStatus, 'not-reviewed')
  assert.equal(contract.ratingReviewStatus, 'unverified')
  assert.equal(contract.optionalRedemption.status, 'terms-recorded-not-calculated')
  assert.ok(contract.species.every(species => species.reviewStatus === 'unverified'))
  assert.equal(contract.cashflows.length, 18)
  assert.equal(contract.cashflows.reduce((sum, flow) => sum + flow.amortization_pct, 0), 100)
  assert.equal(contract.cashflows.find(flow => flow.date === '2032-07-17').interest_pct, 2.8875)
  assert.ok(Math.abs(contract.cashflows.at(-1).interest_pct - 1.65) < 1e-10)
  assert.ok(Object.isFrozen(contract.cashflows))
  assert.throws(() => { contract.annualCouponRate = 0.1 }, TypeError)
})

test('published PDF copies match the archived original snapshots and every evidence locator resolves', () => {
  const contract = auditedContracts.YM34D
  for (const document of contract.documents) {
    const local = readFileSync(new URL(`public${document.localPath}`, root))
    assert.equal(local.subarray(0, 5).toString(), '%PDF-')
    assert.equal(local.length, document.bytes)
    assert.equal(createHash('sha256').update(local).digest('hex'), document.sha256)
    assert.ok(document.url.startsWith('https://inversores.ypf.com/'))
    const original = readFileSync(new URL(`research/fixed-income/documents/${document.localPath.split('/').at(-1)}`, root))
    assert.deepEqual(local, original)
  }
  for (const evidence of contract.evidence) {
    const document = contract.documents.find(document => document.id === evidence.documentId)
    assert.ok(document, 'document ID exists')
    assert.ok(evidence.pdfPages.every(page => Number.isInteger(page) && page >= 1 && page <= document.pages))
    assert.ok(evidence.fields.every(field => Object.hasOwn(contract, field)))
  }
})

test('candidate ingestion checks structure but never marks extracted claims as publishable', () => {
  const contract = auditedContracts.YM34D
  const candidate = { schemaVersion: 1, scope: 'original-issuance', instrumentId: contract.instrumentId,
    proposedTerms: { issueDate: contract.issueDate, maturityDate: contract.maturityDate,
      annualCouponRate: contract.annualCouponRate, frequency: contract.frequency,
      currency: contract.currency, cashflows: contract.cashflows },
    documents: contract.documents, evidence: contract.evidence }
  const result = inspectCandidate(candidate)
  assert.equal(result.validation.status, 'structurally-valid')
  assert.equal(result.reviewStatus, 'pending-review')
  assert.equal(result.publishable, false)
  const bad = inspectCandidate({ ...candidate, evidence: [], proposedTerms: {
    ...candidate.proposedTerms, cashflows: [{ date: '2034-01-17', interest_pct: 4, amortization_pct: 10 }],
  } })
  assert.ok(bad.validation.issues.includes('original_principal_does_not_sum_to_100'))
  assert.ok(bad.validation.issues.includes('missing_evidence:cashflows'))
  assert.equal(bad.publishable, false)
  assert.equal(inspectCandidate(null).validation.status, 'requires-correction')
})
