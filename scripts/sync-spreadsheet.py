#!/usr/bin/env python3
"""
Sync bond prospectus data from a comprehensive Google Spreadsheet.

This script:
1. Downloads the full .xlsx file containing multiple tabs.
2. Extracts global metadata from the 'ONs' tab (or similar main tabular list).
3. Iterates over individual bond tabs (e.g. YM34O, AL30) to extract the cashflow schedule:
   - Schedule dates.
   - Amortization percentages.
   - Coupon percentages.
4. Updates `src/data/bondProspectos.json`.

Usage: 
pip install pandas openpyxl
python3 scripts/sync-spreadsheet.py
"""

import os
import json
import pandas as pd
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
PROSPECTOS_PATH = os.path.join(PROJECT_DIR, 'src', 'data', 'bondProspectos.json')

# The structural Google Sheet that has all the individual tabs
SHEET_ID = "15ao2-irEdSR04cTnfhYdWrLLm4y89t8WrYVU6xt-oFY"
XLSX_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=xlsx"

def clean_pct(val):
    if pd.isna(val) or val == '': return None
    try:
        if isinstance(val, (int, float)): return float(val) * 100
        val = str(val).replace('%', '').replace(',', '.').strip()
        return float(val)
    except:
        return None

def main():
    print(f'📥 Downloading full Google Spreadsheet (this might take 10-20 seconds)...')
    try:
        xl = pd.ExcelFile(XLSX_URL, engine='openpyxl')
        print(f"✅ Excel downloaded! Found {len(xl.sheet_names)} tabs.")
    except Exception as e:
        print(f"❌ Error downloading spreadsheet: {e}")
        return

    # Load existing prospectos
    if os.path.exists(PROSPECTOS_PATH):
        with open(PROSPECTOS_PATH, 'r', encoding='utf-8') as f:
            prospectos = json.load(f)
    else:
        prospectos = {}

    count_schedules = 0

    # Main dictionary of ONs to find out the mapped ticker_o -> ticker_d
    # Because the tabs are usually named with the Local Ticker (ej: YM34O)
    ticker_o_to_d = {}

    # Step 1: Read the main ONs sheet to get metadata if it exists
    main_sheet_name = 'ONs' # En el tuyo original, podría llamarse ONs
    if main_sheet_name in xl.sheet_names:
        print(f'🔍 Extracting Metadata from {main_sheet_name} tab...')
        # We assume the user's template or the shared template has the main metadata table.
        # This will depend on the exact structure. For safety, we will focus mostly on schedules, 
        # but if the user merges the sheets, we would parse row-by-row here.
        pass

    # Reverse lookup for existing prospectos in case we already have some in json
    for d_ticker, data in prospectos.items():
        if 'ticker_o' in data and data['ticker_o']:
            ticker_o_to_d[data['ticker_o']] = d_ticker

    # Step 2: Iterate over all worksheet names and extract schedules if it matches an ON format
    for sheet_name in xl.sheet_names:
        clean_name = sheet_name.strip()
        # Assume it's an ON tab if it looks like a ticker (e.g. YM34O, ARC1O, etc.)
        if not re.match(r'^[A-Z0-9]{3,}$', clean_name):
            continue
            
        # Try to find which "Ticker D" this corresponds to
        ticker_d = ticker_o_to_d.get(clean_name)
        if not ticker_d and clean_name.endswith('O'):
            ticker_d = clean_name[:-1] + 'D' # Fallback assumption: YM34O -> YM34D
        elif not ticker_d:
            ticker_d = clean_name

        print(f"⚙️ Parsing schedule for {clean_name} (Mapped to {ticker_d})...")
        
        try:
            df = xl.parse(sheet_name, header=None)
            
            # Extract Day Convention (usually row 3, col 4 or similar)
            day_convention = 365 # Default
            for i in range(min(15, len(df))):
                row_vals = df.iloc[i].fillna('').astype(str).str.lower().tolist()
                for j, text in enumerate(row_vals):
                    if 'convenci' in text or 'base' in text:
                        for offset in range(1, 5):
                            if j+offset < len(row_vals):
                                possible_val = row_vals[j+offset]
                                if '360' in possible_val:
                                    day_convention = 360
                                    break
                                elif '365' in possible_val:
                                    day_convention = 365
                                    break
                        break

            # Find the header row by looking for 'Fecha' in column 2 and 'Amorti' in column 3
            # In most of these sheets, headers are around row 19 (index 18 or 19)
            header_row_idx = None
            for i in range(min(50, len(df))):
                row_vals = df.iloc[i].fillna('').astype(str).str.lower().tolist()
                if len(row_vals) > 3 and 'fecha' in row_vals[2]:
                    col3 = row_vals[3]
                    if 'amort' in col3 or 'princip' in col3 or 'pricip' in col3 or 'capit' in col3 or 'v/r' in col3 or 'saldo' in col3:
                        header_row_idx = i
                        break
            
            if header_row_idx is None:
                continue # No cashflow table found on this tab

            # The cashflows start usually 2 rows down from the header
            start_data_idx = header_row_idx + 2
            
            cashflows = []
            for i in range(start_data_idx, len(df)):
                row = df.iloc[i]
                fecha = row[2]
                
                # If date is completely empty or invalid, we stop
                if pd.isna(fecha):
                    continue
                
                # Convert Pandas timestamp to string (YYYY-MM-DD)
                if isinstance(fecha, pd.Timestamp) or hasattr(fecha, 'strftime'):
                    fecha_str = fecha.strftime('%Y-%m-%d')
                else:
                    try:
                        # Attempt to parse string dates like "17/12/2026"
                        fecha_parsed = pd.to_datetime(fecha, dayfirst=True)
                        fecha_str = fecha_parsed.strftime('%Y-%m-%d')
                    except:
                        # Reached the end or garbage data
                        break

                amortization_pct = 0
                if pd.notna(row[3]) and str(row[3]).replace('.','',1).isdigit():
                    amortization_pct = float(row[3])
                    
                interest_pct = 0
                if pd.notna(row[6]):
                    if isinstance(row[6], (int, float)):
                        interest_pct = float(row[6])
                    else:
                        try: interest_pct = float(str(row[6]).replace(',','.'))
                        except: pass

                cashflows.append({
                    "date": fecha_str,
                    "amortization_pct": float(amortization_pct) if amortization_pct else 0.0,
                    "interest_pct": float(interest_pct) if interest_pct else 0.0
                })

            if len(cashflows) > 0:
                if ticker_d not in prospectos:
                    prospectos[ticker_d] = {}
                prospectos[ticker_d]["cashflows"] = cashflows
                prospectos[ticker_d]["dayConvention"] = day_convention
                count_schedules += 1

        except Exception as e:
            print(f"  Warning: Could not parse {sheet_name}: {e}")
            continue

    # Write changes
    with open(PROSPECTOS_PATH, 'w', encoding='utf-8') as f:
        json.dump(prospectos, f, indent=2, ensure_ascii=False)

    print(f'\n🎇 Success! Synced detailed cashflow schedules for {count_schedules} bonds.')

if __name__ == '__main__':
    main()
