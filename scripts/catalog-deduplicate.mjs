import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { inspectCatalogSource } from './catalog-source.mjs'

const catalogPath = new URL('../src/data/bondProspectos.json', import.meta.url)
const historyDir = new URL('../research/fixed-income/catalog-history/', import.meta.url)
const snapshotPath = new URL('catalog-before-2026-10-27.json', historyDir)
const decisionPath = new URL('deduplication-2026-10-27.json', historyDir)
const bytes = readFileSync(catalogPath)
const raw = bytes.toString('utf8')
const inspected = inspectCatalogSource(raw, { rejectDuplicates: false })
if (inspected.duplicates.length === 0) {
  console.log('No duplicate keys; catalog unchanged.')
} else {
  mkdirSync(historyDir, { recursive: true })
  if (existsSync(snapshotPath) || existsSync(decisionPath)) {
    throw new Error('History already exists. Review explicitly before another migration; no files changed.')
  }
  const grouped = new Map()
  for (const occurrence of inspected.occurrences) {
    if (!grouped.has(occurrence.key)) grouped.set(occurrence.key, [])
    grouped.get(occurrence.key).push(occurrence)
  }
  const decisions = inspected.duplicates.map(({ key }) => {
    const versions = grouped.get(key)
    const selected = versions.at(-1)
    const allFields = new Set(versions.flatMap(version => Object.keys(version.value)))
    return { key, decision: 'preserve_previous_effective_record_without_merging',
      reason: 'Preserves the object previously used by JSON.parse; this is compatibility, not contractual validation.',
      selectedSourceLine: selected.line,
      occurrences: versions.map(version => ({ sourceLine: version.line, record: version.value })),
      fields: [...allFields].map(field => ({ field,
        decision: Object.hasOwn(selected.value, field) ? 'keep_last_effective_value' : 'remain_unknown_no_inheritance',
        valuesByOccurrence: versions.map(version => Object.hasOwn(version.value, field)
          ? { present: true, value: version.value[field] } : { present: false }) })) }
  })
  const selectedOccurrences = inspected.occurrences.filter(occurrence => grouped.get(occurrence.key).at(-1) === occurrence)
  const uniqueRaw = `{\n${selectedOccurrences.map(occurrence => `  ${raw.slice(occurrence.keyStart, occurrence.valueEnd).trimEnd()}`).join(',\n')}\n}\n`
  const accepted = inspectCatalogSource(uniqueRaw)
  if (JSON.stringify(accepted.catalog) !== JSON.stringify(inspected.catalog)) {
    // Key insertion order changes when an early duplicate is removed. Compare values independently.
    const keys = Object.keys(inspected.catalog)
    if (keys.length !== Object.keys(accepted.catalog).length || keys.some(key =>
      JSON.stringify(inspected.catalog[key]) !== JSON.stringify(accepted.catalog[key]))) {
      throw new Error('Migration would change effective values; no files changed.')
    }
  }
  writeFileSync(snapshotPath, bytes, { flag: 'wx' })
  writeFileSync(decisionPath, `${JSON.stringify({ date: '2026-10-27',
    sourceSnapshot: 'catalog-before-2026-10-27.json', sourceSha256: createHash('sha256').update(bytes).digest('hex'),
    outputSha256: createHash('sha256').update(uniqueRaw).digest('hex'),
    scope: 'Top-level uniqueness only. All prior effective property values preserved. Missing fields remain unknown.',
    decisions }, null, 2)}\n`, { flag: 'wx' })
  writeFileSync(catalogPath, uniqueRaw)
  console.log(`Resolved ${decisions.length} duplicate names; original snapshot and per-field decisions archived.`)
}
