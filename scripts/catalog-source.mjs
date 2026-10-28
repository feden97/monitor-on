import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Scan top-level entries before accepting a JSON object; nested keys stay local. */
export function inspectCatalogSource(raw, { rejectDuplicates = true } = {}) {
  if (typeof raw !== 'string') throw new TypeError('Catalog source must be text')
  let index = raw.charCodeAt(0) === 0xfeff ? 1 : 0
  const whitespace = () => { while (/\s/.test(raw[index] ?? '') && index < raw.length) index++ }
  const stringEnd = () => {
    if (raw[index] !== '"') throw new SyntaxError('Expected a quoted catalog key')
    index++
    while (index < raw.length) {
      const char = raw[index++]
      if (char === '\\') index++
      else if (char === '"') return index
    }
    throw new SyntaxError('Unterminated JSON string')
  }
  whitespace()
  if (raw[index++] !== '{') throw new SyntaxError('Catalog must be a JSON object')
  const occurrences = []
  whitespace()
  while (raw[index] !== '}') {
    const keyStart = index
    const keyEnd = stringEnd()
    const key = JSON.parse(raw.slice(keyStart, keyEnd))
    whitespace()
    if (raw[index++] !== ':') throw new SyntaxError('Expected colon after catalog key')
    whitespace()
    const valueStart = index
    let depth = 0
    while (index < raw.length) {
      const char = raw[index]
      if (char === '"') { stringEnd(); continue }
      if ((char === ',' || char === '}') && depth === 0) break
      if (char === '{' || char === '[') depth++
      if (char === '}' || char === ']') depth--
      index++
    }
    const valueEnd = index
    const value = JSON.parse(raw.slice(valueStart, valueEnd))
    occurrences.push({ key, value, keyStart, valueStart, valueEnd,
      line: raw.slice(0, keyStart).split('\n').length })
    whitespace()
    if (raw[index] === ',') {
      index++
      whitespace()
      if (raw[index] === '}') throw new SyntaxError('Trailing comma in catalog')
    } else if (raw[index] !== '}') {
      throw new SyntaxError('Expected comma or closing catalog brace')
    }
  }
  index++
  whitespace()
  if (index !== raw.length) throw new SyntaxError('Unexpected data after catalog')
  const grouped = new Map()
  for (const occurrence of occurrences) {
    if (!grouped.has(occurrence.key)) grouped.set(occurrence.key, [])
    grouped.get(occurrence.key).push(occurrence)
  }
  const duplicates = [...grouped].filter(([, values]) => values.length > 1)
    .map(([key, values]) => ({ key, lines: values.map(value => value.line) }))
  if (rejectDuplicates && duplicates.length) {
    throw new SyntaxError(`Duplicate catalog keys: ${duplicates.map(value => value.key).join(', ')}`)
  }
  return { catalog: JSON.parse(raw.replace(/^\uFEFF/, '')), occurrences, duplicates }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const catalogPath = process.argv[2] ?? new URL('../src/data/bondProspectos.json', import.meta.url)
  const { catalog, duplicates } = inspectCatalogSource(readFileSync(catalogPath, 'utf8'))
  console.log(JSON.stringify({ instruments: Object.keys(catalog).filter(key => !key.startsWith('_')).length,
    duplicateKeys: duplicates.length, status: 'unique_top_level_keys' }))
}
