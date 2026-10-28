import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

/** Local extraction candidates only. Structural checks NEVER approve publication. */
export function inspectCandidate(candidate) {
  const issues = []
  const required = ['issueDate', 'maturityDate', 'annualCouponRate', 'frequency', 'currency', 'cashflows']
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { reviewStatus: 'pending-review', publishable: false,
      validation: { status: 'requires-correction', issues: ['candidate_must_be_object'] } }
  }
  if (candidate.schemaVersion !== 1) issues.push('unsupported_schema_version')
  if (candidate.scope !== 'original-issuance') issues.push('unsupported_scope')
  if (typeof candidate.instrumentId !== 'string' || !candidate.instrumentId.trim()) issues.push('missing_instrument_id')
  const terms = candidate.proposedTerms ?? {}
  if (!validDate(terms.issueDate) || !validDate(terms.maturityDate) || terms.issueDate >= terms.maturityDate) {
    issues.push('invalid_issue_or_maturity_date')
  }
  if (!Number.isFinite(terms.annualCouponRate) || terms.annualCouponRate < 0) issues.push('invalid_coupon_rate')
  if (!Number.isSafeInteger(terms.frequency) || terms.frequency <= 0) issues.push('invalid_coupon_frequency')
  if (typeof terms.currency !== 'string' || !/^[A-Z]{3}$/.test(terms.currency)) issues.push('invalid_currency')
  const flows = terms.cashflows
  if (!Array.isArray(flows) || flows.length === 0) issues.push('missing_cashflows')
  else {
    const valid = flows.every(flow => flow && validDate(flow.date)
      && Number.isFinite(flow.interest_pct) && flow.interest_pct >= 0
      && Number.isFinite(flow.amortization_pct) && flow.amortization_pct >= 0
      && flow.date > terms.issueDate && flow.date <= terms.maturityDate)
    if (!valid) issues.push('invalid_cashflow')
    else {
      if (new Set(flows.map(flow => flow.date)).size !== flows.length) issues.push('duplicate_cashflow_dates')
      if (Math.abs(flows.reduce((sum, flow) => sum + flow.amortization_pct, 0) - 100) > 1e-6) issues.push('original_principal_does_not_sum_to_100')
      if (flows.reduce((last, flow) => flow.date > last ? flow.date : last, '') !== terms.maturityDate) issues.push('final_flow_differs_from_maturity')
    }
  }
  const documents = Array.isArray(candidate.documents) ? candidate.documents : []
  const documentIds = new Set()
  for (const document of documents) {
    let validUrl = false
    try { validUrl = new URL(document?.url).protocol === 'https:' } catch { /* invalid evidence URL */ }
    if (!document?.id || documentIds.has(document.id) || !validUrl
      || !/^[a-f\d]{64}$/i.test(document.sha256 ?? '') || !Number.isSafeInteger(document.pages) || document.pages < 1) {
      issues.push('invalid_document_metadata')
    }
    documentIds.add(document?.id)
  }
  if (documents.length === 0) issues.push('missing_documents')
  const evidence = Array.isArray(candidate.evidence) ? candidate.evidence : []
  for (const field of required) {
    const matching = evidence.filter(entry => Array.isArray(entry?.fields) && entry.fields.includes(field))
    const supported = matching.some(entry => {
      const document = documents.find(document => document?.id === entry.documentId)
      return document && Array.isArray(entry.pdfPages) && entry.pdfPages.length > 0
        && entry.pdfPages.every(page => Number.isInteger(page) && page >= 1 && page <= document.pages)
    })
    if (!supported) issues.push(`missing_evidence:${field}`)
  }
  return { reviewStatus: 'pending-review', publishable: false,
    validation: { status: issues.length ? 'requires-correction' : 'structurally-valid', issues },
    note: 'Structural validation does not verify document contents, authenticity, later events or legal/financial interpretation. Publication requires explicit review.' }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error('Usage: node scripts/catalog-candidate.mjs PATH_TO_EXTRACTED_CANDIDATE.json')
  const raw = readFileSync(process.argv[2])
  const candidate = JSON.parse(raw.toString('utf8'))
  const result = inspectCandidate(candidate)
  const sha256 = createHash('sha256').update(raw).digest('hex')
  const outputDir = new URL('../research/fixed-income/candidates/', import.meta.url)
  mkdirSync(outputDir, { recursive: true })
  const slug = typeof candidate?.instrumentId === 'string'
    ? candidate.instrumentId.toLowerCase().replace(/[^a-z\d-]/g, '-').slice(0, 64) : 'unknown-instrument'
  const stem = `${slug || 'unknown-instrument'}-${sha256.slice(0, 12)}`
  writeFileSync(new URL(`${stem}.source.json`, outputDir), raw)
  writeFileSync(new URL(`${stem}.review.json`, outputDir), `${JSON.stringify({
    sourceSha256: sha256, sourceFile: `${stem}.source.json`, ...result,
  }, null, 2)}\n`)
  console.log(JSON.stringify({ ...result, reviewFile: `research/fixed-income/candidates/${stem}.review.json` }, null, 2))
}
