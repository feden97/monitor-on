import json
import os
import requests
from datetime import datetime

# Configuración de rutas
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
DATA_PATH = os.path.join(PROJECT_DIR, 'src', 'data', 'bondProspectos.json')
PDF_DIR = os.path.join(PROJECT_DIR, 'public', 'pdfs')

# Configuración API MAE
MAE_BASE_URL = "https://api.marketdata.mae.com.ar/api/emisiones/on"
MAE_HEADERS = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Origin": "https://marketdata.mae.com.ar",
    "Referer": "https://marketdata.mae.com.ar/",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def get_existing_tickers():
    if not os.path.exists(DATA_PATH):
        return set()
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
        return set(data.keys())

def fetch_mae_on_list():
    LOCAL_LIST_PATH = os.path.join(PROJECT_DIR, 'src', 'data', 'mae_all_on_list.json')
    if os.path.exists(LOCAL_LIST_PATH):
        print(f"Cargando listado desde archivo local: {LOCAL_LIST_PATH}")
        with open(LOCAL_LIST_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)

    print("Consultando listado de ONs en MAE via API...")
    return []

def fetch_bond_details(mae_id, codigo):
    url = f"{MAE_BASE_URL}/{mae_id}/{codigo}"
    try:
        response = requests.get(url, headers=MAE_HEADERS, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error al obtener detalles del bono {mae_id}/{codigo}: {e}")
        return None

def download_pdf(url, ticker):
    if not url:
        return False
    
    filename = f"{ticker}_prospecto.pdf"
    filepath = os.path.join(PDF_DIR, filename)
    
    print(f"Descargando PDF para {ticker} desde {url}...")
    try:
        response = requests.get(url, stream=True, headers=MAE_HEADERS, timeout=20)
        response.raise_for_status()
        
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"Guardado en: {filepath}")
        return True
    except Exception as e:
        print(f"No se pudo descargar el PDF para {ticker}: {e}")
        return False

def main():
    if not os.path.exists(PDF_DIR):
        os.makedirs(PDF_DIR)

    existing_tickers = get_existing_tickers()
    mae_list = fetch_mae_on_list()
    
    new_instrumentos = []
    
    print(f"Total instrumentos en listado: {len(mae_list)}")
    
    normalized_existing = {t.strip().upper() for t in existing_tickers}

    for item in mae_list:
        ticker = item.get('especies', '').strip().upper()
        if not ticker:
            continue
            
        base_ticker = ticker[:-1] if ticker.endswith(('O', 'D')) else ticker
        found = False
        for existing in normalized_existing:
            if existing.startswith(base_ticker):
                found = True
                break
        
        if not found:
            new_instrumentos.append(item)

    print(f"Nuevos instrumentos detectados: {len(new_instrumentos)}")
    for item in new_instrumentos:
        print(f" - {item.get('especies')} ({item.get('emisores')})")

    for item in new_instrumentos:
        ticker = item['especies'].strip()
        mae_id = item.get('id')
        codigo = item.get('codigo')
        
        if not mae_id or not codigo:
            continue

        print(f"\nProcesando nuevo bono: {ticker}")
        details = fetch_bond_details(mae_id, codigo)
        
        if details and 'documentos' in details:
            docs = details['documentos']
            target_doc = next((d for d in docs if 'aviso' in d.get('titulo', '').lower() and 'resultado' in d.get('titulo', '').lower()), None)
            if not target_doc:
                target_doc = next((d for d in docs if 'prospecto' in d.get('titulo', '').lower() or 'suplemento' in d.get('titulo', '').lower()), docs[0] if docs else None)
            
            if target_doc:
                download_pdf(target_doc['url'], ticker)
            else:
                print(f"No se encontraron documentos para {ticker}")
        else:
            print(f"No se pudieron obtener detalles para {ticker}")

    print("\nMonitoreo finalizado.")

if __name__ == "__main__":
    main()
