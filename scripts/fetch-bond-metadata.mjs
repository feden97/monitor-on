#!/usr/bin/env node

/**
 * Pre-fetch bond metadata from BYMA Open Data API.
 *
 * This script:
 * 1. Fetches all D-tickers from data912
 * 2. For each ticker, fetches metadata from BYMA ficha técnica
 * 3. Saves everything to src/data/bondsMetadata.json
 *
 * Run: node scripts/fetch-bond-metadata.mjs
 * Run when: new ONs are listed or you want to refresh static data.
 */

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = join(__dirname, '..', 'src', 'data', 'bondsMetadata.json')

const DATA912_URL = 'https://data912.com/live/arg_corp'
const BYMA_BASE = 'https://open.bymadata.com.ar'
const BYMA_PROFILE = `${BYMA_BASE}/vanoms-be-core/rest/api/bymadata/free/bnown/fichatecnica/especies/general`

const BYMA_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
  'Origin': BYMA_BASE,
  'Referer': `${BYMA_BASE}/`,
}

// ── Step 1: Get session cookies ─────────────────────────────────────

async function initSession() {
  console.log('🔐 Initializing BYMA session...')
  const res = await fetch(`${BYMA_BASE}/#/dashboard`, {
    headers: { 'User-Agent': BYMA_HEADERS['User-Agent'] },
  })
  const cookies = res.headers.getSetCookie?.() || []
  const cookieStr = cookies.map(c => c.split(';')[0]).join('; ')
  console.log(`   Got ${cookies.length} cookies`)
  return cookieStr
}

// ── Step 2: Fetch all D-tickers from data912 ────────────────────────

async function fetchTickers() {
  console.log('📡 Fetching tickers from data912...')
  const res = await fetch(DATA912_URL)
  const data = await res.json()
  const dTickers = data
    .filter(r => r.symbol && r.symbol.endsWith('D'))
    .map(r => r.symbol)
  console.log(`   Found ${dTickers.length} D-tickers`)
  return dTickers
}

// ── Step 3: Fetch metadata for one ticker ───────────────────────────

async function fetchMetadata(symbol, cookies) {
  try {
    const res = await fetch(BYMA_PROFILE, {
      method: 'POST',
      headers: { ...BYMA_HEADERS, 'Cookie': cookies },
      body: JSON.stringify({ symbol, 'Content-Type': 'application/json' }),
    })

    if (!res.ok) return null

    const result = await res.json()
    if (!result.data || result.data.length === 0) return null

    const raw = result.data[0]
    return {
      emisor: raw.emisor || '',
      isin: raw.codigoIsin || '',
      fechaEmision: raw.fechaEmision ? raw.fechaEmision.split(' ')[0] : '',
      fechaVencimiento: raw.fechaVencimiento ? raw.fechaVencimiento.split(' ')[0] : '',
      moneda: raw.moneda || '',
      interes: raw.interes || '',
      formaAmortizacion: raw.formaAmortizacion || '',
      denominacionMinima: raw.denominacionMinima || 1,
      montoResidual: raw.montoResidual || 0,
      montoNominal: raw.montoNominal || 0,
      tipoGarantia: raw.tipoGarantia || '',
      denominacion: raw.denominacion || '',
      ley: raw.paisLey || raw.ley || '',
    }
  } catch {
    return null
  }
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('  BYMA Bond Metadata Pre-Fetcher')
  console.log('═══════════════════════════════════════════════\n')

  const cookies = await initSession()
  const tickers = await fetchTickers()

  const metadata = {}
  let success = 0
  let failed = 0

  console.log(`\n🔄 Fetching metadata for ${tickers.length} tickers...\n`)

  // Process in batches of 5 with 500ms delay
  const batchSize = 5
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize)

    const results = await Promise.allSettled(
      batch.map(t => fetchMetadata(t, cookies))
    )

    for (let j = 0; j < batch.length; j++) {
      const ticker = batch[j]
      const result = results[j]

      if (result.status === 'fulfilled' && result.value) {
        metadata[ticker] = result.value
        success++
        process.stdout.write(`   ✅ ${ticker} — ${result.value.emisor}\n`)
      } else {
        failed++
        process.stdout.write(`   ❌ ${ticker}\n`)
      }
    }

    // Rate limiting delay
    if (i + batchSize < tickers.length) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  // Save
  const output = {
    _generatedAt: new Date().toISOString(),
    _totalTickers: tickers.length,
    _successCount: success,
    _failedCount: failed,
    bonds: metadata,
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8')

  console.log(`\n═══════════════════════════════════════════════`)
  console.log(`  ✅ Success: ${success} | ❌ Failed: ${failed}`)
  console.log(`  📄 Saved to: src/data/bondsMetadata.json`)
  console.log(`═══════════════════════════════════════════════\n`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
