#!/usr/bin/env python3
"""
Sync bond prospectus data from Google Spreadsheet.

This script:
1. Downloads the CSV from the user's Google Spreadsheet.
2. Parses fixed fields: Law, Dollar Type, Rating, Min Investment, Frequency.
3. Updates src/data/bondProspectos.json preserving existing cash flow data.

Usage: python3 scripts/sync-spreadsheet.py
"""

import json
import csv
import subprocess
import os
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
PROSPECTOS_PATH = os.path.join(PROJECT_DIR, 'src', 'data', 'bondProspectos.json')
SHEET_URL = "https://docs.google.com/spreadsheets/d/1ZNqjNlF6gSzbMeIV56eB75oQ1i9fx85oAHEdGCC8jSY/gviz/tq?tqx=out:csv&gid=1537756600"

def clean_pct(val):
    if not val: return None
    try:
        # "8,50%" -> 8.5
        v = val.replace('%', '').replace(',', '.').strip()
        return float(v)
    except:
        return None

def clean_int(val):
    if not val: return None
    try:
        # "1.000" -> 1000
        v = val.replace('.', '').replace(',', '').strip()
        return int(v)
    except:
        return None

def main():
    print('📥 Downloading spreadsheet CSV...')
    result = subprocess.run(['curl', '-sk', SHEET_URL], capture_output=True, text=True)
    if result.returncode != 0:
        print("❌ Error downloading spreadsheet")
        return

    # Parse CSV
    lines = result.stdout.splitlines()
    reader = csv.reader(lines)
    header = next(reader)
    
    # Skip the second header-like row (dates/MEP)
    next(reader)

    # Load existing prospectos
    if os.path.exists(PROSPECTOS_PATH):
        with open(PROSPECTOS_PATH, 'r', encoding='utf-8') as f:
            prospectos = json.load(f)
    else:
        prospectos = {}

    count = 0
    for row in reader:
        if len(row) < 26: continue
        
        name = row[0].strip()
        ticker_d = row[1].strip()
        ticker_o = row[2].strip()
        
        if not ticker_d or ticker_d == "U$S": continue

        # Mapping based on observation:
        # 3: Renta (%)
        # 4: Cupones x año
        # 22: Minimo
        # 23: Ley
        # 24: Dolar
        # 25: Calificacion
        
        coupon_str = row[3].strip()
        freq = clean_int(row[4])
        min_nominal = clean_int(row[22])
        ley = row[23].strip() # ARG / NY
        dolar = row[24].strip() # MEP / Cable
        rating = row[25].strip()

        # Update or create entry
        if ticker_d not in prospectos:
            prospectos[ticker_d] = {}
        
        p = prospectos[ticker_d]
        p['ticker_o'] = ticker_o
        p['name'] = name
        
        if coupon_str: 
            p['coupon_rate'] = clean_pct(coupon_str)
        
        if freq: 
            p['frequency'] = freq
            
        if min_nominal:
            p['min_investment'] = min_nominal
            
        if ley:
            p['law'] = "NY" if "NY" in ley.upper() else "ARG"
            
        if dolar:
            p['currency_type'] = "CCL" if "CABLE" in dolar.upper() else "MEP"
            
        if rating:
            p['rating'] = rating

        count += 1

    # Save
    with open(PROSPECTOS_PATH, 'w', encoding='utf-8') as f:
        json.dump(prospectos, f, indent=2, ensure_ascii=False)

    print(f'✅ Synced {count} bonds to {PROSPECTOS_PATH}')

if __name__ == '__main__':
    main()
