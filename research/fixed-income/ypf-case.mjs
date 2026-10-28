import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const dir = new URL('./', import.meta.url)
export const terms = JSON.parse(readFileSync(new URL('ypf-xxxiv.json', dir), 'utf8'))

/** Specific fixed-rate, regular-coupon case. Not a universal schedule generator. */
export function contractualFlows() {
  let outstanding = 100
  const amort = new Map(terms.amortization.map(f => [f.date, f.originalPrincipal]))
  const result = []
  for (let year = 2025; year <= 2034; year++) {
    for (const md of terms.couponMonthDays) {
      const date = `${year}-${md}`
      if (date < terms.firstCouponDate || date > terms.maturityDate) continue
      const interest = outstanding * terms.annualCouponRate / terms.frequency
      const principal = amort.get(date) ?? 0
      result.push({ date, openingPrincipal: outstanding, interest, principal, total: interest + principal })
      outstanding -= principal
    }
  }
  if (Math.abs(outstanding) > 1e-10) throw new Error('Contract principal does not close')
  return result
}

export function verifyDocuments() {
  const manifest = JSON.parse(readFileSync(new URL('documents/manifest.json', dir), 'utf8'))
  return manifest.documents.map(doc => {
    const bytes = readFileSync(new URL(`documents/${doc.file}`, dir))
    const hash = createHash('sha256').update(bytes).digest('hex')
    if (hash !== doc.sha256 || bytes.length !== doc.bytes || bytes.subarray(0, 5).toString() !== '%PDF-') {
      throw new Error(`Document integrity failed: ${doc.file}`)
    }
    return { file: doc.file, sha256: hash, status: 'matches_archived_snapshot' }
  })
}

export function compareCatalog(catalog) {
  const stored = catalog[terms.tickerForLocalCatalogComparison]
  const byDate = new Map(contractualFlows().map(f => [f.date, f]))
  const flows = Array.isArray(stored?.cashflows) ? stored.cashflows : []
  const differences = Array.isArray(stored?.cashflows) ? [] : [{ reason: 'missing_or_invalid_schedule' }]
  const ignoredZeroMarkers = []
  const seen = new Set()
  for (const f of flows) {
    if (f?.interest_pct === 0 && f?.amortization_pct === 0) {
      ignoredZeroMarkers.push(f.date)
      continue
    }
    if (!f || !Number.isFinite(f.interest_pct) || !Number.isFinite(f.amortization_pct)) {
      differences.push({ date: f?.date ?? null, reason: 'invalid_amount' })
      continue
    }
    const expected = byDate.get(f.date)
    if (seen.has(f.date)) differences.push({ date: f.date, reason: 'duplicate_date' })
    seen.add(f.date)
    if (!expected || Math.abs(expected.interest - f.interest_pct) > 1e-8
      || Math.abs(expected.principal - f.amortization_pct) > 1e-8) {
      differences.push({ date: f.date, reason: 'amount_or_date_differs' })
    }
  }
  // All original dates are checked, including historical coupons, to avoid
  // interpreting omitted history as a contractual discrepancy.
  const missing = contractualFlows().filter(f => !seen.has(f.date)).map(f => f.date)
  return { ticker: terms.tickerForLocalCatalogComparison, comparedStoredFlows: flows.length,
    ignoredZeroMarkers, differences, originalDatesAbsentFromCatalog: missing,
    scope: 'Stored payment amounts vs original no-call contract. Missing historical rows require context; no current-yield adjudication.' }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = new URL('output/', dir)
  mkdirSync(output, { recursive: true })
  const catalog = JSON.parse(readFileSync(new URL('../../src/data/bondProspectos.json', dir), 'utf8'))
  const flows = contractualFlows()
  const report = { reviewDate: terms.reviewDate, scope: terms.reviewScope,
    documents: verifyDocuments(), terms: { coupon: terms.annualCouponRate, frequency: terms.frequency,
      maturity: terms.maturityDate, isinRegS: terms.isinRegS },
    paymentCount: flows.length, totalPrincipal: flows.reduce((s, f) => s + f.principal, 0),
    catalogComparison: compareCatalog(catalog), currentYieldAudit: 'not_performed_no_synchronized_normalized_quotes' }
  // Output directory is tracked with reports; no networking or application edits.
  writeFileSync(new URL('ypf-xxxiv-audit.json', output), `${JSON.stringify(report, null, 2)}\n`)
  const csv = ['date,opening_principal_usd,interest_usd,principal_usd,total_usd',
    ...flows.map(f => [f.date, f.openingPrincipal, f.interest, f.principal, f.total].join(','))].join('\n') + '\n'
  writeFileSync(new URL('ypf-xxxiv-cashflows.csv', output), csv)
  console.log(JSON.stringify(report, null, 2))
}
