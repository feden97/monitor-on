#!/usr/bin/env python3
"""
Pre-fetch bond metadata from BYMA Open Data API using curl (more reliable than Node fetch).

Usage: python3 scripts/fetch-bond-metadata.py

Outputs: src/data/bondsMetadata.json
"""

import json
import subprocess
import sys
import time
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
OUTPUT_PATH = os.path.join(PROJECT_DIR, 'src', 'data', 'bondsMetadata.json')

DATA912_URL = 'https://data912.com/live/arg_corp'
BYMA_BASE = 'https://open.bymadata.com.ar'
BYMA_PROFILE = f'{BYMA_BASE}/vanoms-be-core/rest/api/bymadata/free/bnown/fichatecnica/especies/general'
COOKIE_FILE = '/tmp/byma_metadata_cookies.txt'


def curl_get_cookies():
    """Initialize BYMA session and get cookies."""
    subprocess.run([
        'curl', '-sk', '--connect-timeout', '60', '-m', '90',
        '-c', COOKIE_FILE,
        f'{BYMA_BASE}/#/dashboard'
    ], capture_output=True, timeout=120)


def curl_fetch_metadata(symbol):
    """Fetch metadata for a single ticker using curl."""
    try:
        result = subprocess.run([
            'curl', '-sk',
            '-b', COOKIE_FILE,
            '-X', 'POST', BYMA_PROFILE,
            '-H', 'Content-Type: application/json',
            '-H', f'Origin: {BYMA_BASE}',
            '-H', f'Referer: {BYMA_BASE}/',
            '-H', 'Accept: application/json',
            '-d', json.dumps({'symbol': symbol, 'Content-Type': 'application/json'}),
        ], capture_output=True, text=True, timeout=15)

        if result.returncode != 0:
            return None

        data = json.loads(result.stdout)
        if not data.get('data') or len(data['data']) == 0:
            return None

        raw = data['data'][0]
        return {
            'emisor': raw.get('emisor', ''),
            'isin': raw.get('codigoIsin', ''),
            'fechaEmision': (raw.get('fechaEmision', '') or '').split(' ')[0],
            'fechaVencimiento': (raw.get('fechaVencimiento', '') or '').split(' ')[0],
            'moneda': raw.get('moneda', ''),
            'interes': raw.get('interes', ''),
            'formaAmortizacion': raw.get('formaAmortizacion', ''),
            'denominacionMinima': raw.get('denominacionMinima', 1),
            'montoResidual': raw.get('montoResidual', 0),
            'montoNominal': raw.get('montoNominal', 0),
            'tipoGarantia': raw.get('tipoGarantia', ''),
            'denominacion': raw.get('denominacion', ''),
            'ley': raw.get('paisLey', '') or raw.get('ley', ''),
        }
    except Exception:
        return None


def fetch_tickers():
    """Get all D-tickers from data912."""
    result = subprocess.run(
        ['curl', '-s', DATA912_URL],
        capture_output=True, text=True, timeout=15
    )
    data = json.loads(result.stdout)
    return sorted(set(r['symbol'] for r in data if r.get('symbol', '').endswith('D')))


def main():
    print('═' * 50)
    print('  BYMA Bond Metadata Pre-Fetcher')
    print('═' * 50)
    print()

    # Step 1: Get cookies
    print('🔐 Initializing BYMA session...')
    curl_get_cookies()

    # Step 2: Get tickers
    print('📡 Fetching tickers from data912...')
    tickers = fetch_tickers()
    print(f'   Found {len(tickers)} D-tickers')

    # Step 3: Fetch metadata in sequence with small delays
    metadata = {}
    success = 0
    failed = 0

    print(f'\n🔄 Fetching metadata for {len(tickers)} tickers...\n')

    for i, ticker in enumerate(tickers):
        meta = curl_fetch_metadata(ticker)
        if meta:
            metadata[ticker] = meta
            success += 1
            emisor = meta.get('emisor', '?')[:40]
            print(f'   ✅ [{i+1:3d}/{len(tickers)}] {ticker:8s} — {emisor}')
        else:
            failed += 1
            print(f'   ❌ [{i+1:3d}/{len(tickers)}] {ticker:8s}')

        # Rate limiting: small delay every 5 requests
        if (i + 1) % 5 == 0:
            time.sleep(0.3)

    # Step 4: Save
    output = {
        '_generatedAt': time.strftime('%Y-%m-%dT%H:%M:%S'),
        '_totalTickers': len(tickers),
        '_successCount': success,
        '_failedCount': failed,
        'bonds': metadata,
    }

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f'\n{"═" * 50}')
    print(f'  ✅ Success: {success} | ❌ Failed: {failed}')
    print(f'  📄 Saved to: src/data/bondsMetadata.json')
    print(f'{"═" * 50}\n')

    # Cleanup
    try:
        os.remove(COOKIE_FILE)
    except Exception:
        pass


if __name__ == '__main__':
    main()
