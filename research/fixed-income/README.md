# Laboratorio de renta fija

Primer trabajo local para evolucionar Monitor ON, revisado el 27/10/2026. No está conectado a la aplicación publicada.

## Ejecutar

Requiere Node 24 y Python 3; Python solo utiliza biblioteca estándar. Desde la raíz del repositorio:

```powershell
node --test --test-isolation=none research/fixed-income/*.test.mjs tests/*.test.js
python -m unittest discover -s research/fixed-income -p 'test_*.py' -v
python research/fixed-income/catalog_audit.py --as-of 2026-10-27 --output research/fixed-income/output/catalog-audit-2026-10-27.json
node research/fixed-income/ypf-case.mjs
```

`--test-isolation=none` permite ejecutar las pruebas en el sandbox de Windows que restringe crear procesos. En un entorno sin esa limitación puede omitirse. No hace falta instalar dependencias para el laboratorio. El comando `python` debe apuntar a Python 3; si no existe en PATH, usar su ruta completa.

## Contenido

| Archivo | Uso |
| --- | --- |
| `math.mjs` | Precio sucio, TIR y sensibilidades con flujos positivos/tiempos dados y base efectiva o nominal explícita. Tasas decimales. |
| `book-evidence.md` | Páginas del libro revisadas, resultados, aparente errata y diferencia de definición de convexidad. |
| `catalog_audit.py` | Auditoría estructural de `src/data/bondProspectos.json`, conservando duplicados que JSON normalmente oculta. |
| `ypf-xxxiv.json` | Condiciones originales de YPF internacional Clase XXXIV con evidencia por campo. |
| `ypf-case.mjs` | Reconstrucción de 18 pagos regulares, comparación con catálogo efectivo y control de integridad de PDFs archivados. |
| `documents/manifest.json` | URLs, fechas de documento/descarga, tamaño y SHA-256 de las tres copias originales archivadas. |
| `output/` | Auditoría del catálogo, resultado YPF y cronograma CSV regenerables. |

## Resultados y alcance

El catálogo contiene 243 instrumentos efectivos, cinco nombres duplicados y 34 cronogramas vacíos. Son alertas de revisión; no se corrigen ni se completan automáticamente.

Los 18 pagos económicos originales de YM34D coinciden con su último objeto efectivo del catálogo. Dos marcadores cero se informan por separado. Los cupones posteriores a amortizar 30 y 30 disminuyen a 2,8875 y 1,65 por VN original 100.

La comprobación de hashes certifica que los archivos coinciden con las copias descargadas el 27/10/2026; no consulta cambios futuros. Las fechas de pago del CSV son contractuales sin ajustar. No se calcula una TIR de mercado de YM34D ni YTW: faltan snapshots equivalentes y convenciones de negociación verificadas. Los rescates make-whole y otros eventos no se modelan aquí.

El motor recibe tiempos ya normalizados: no calcula derechos al cupón, calendarios, cupón corrido ni índices. `convexity` significa P''/P; `convexityTaylorCoefficient` incluye el factor 1/2 para escenarios. La fuente del libro permanece privada y no se copia al repositorio.

La propuesta y los hallazgos técnicos están en `docs/PROPOSAL_MONITOR_V2.md`, `docs/repository-audit.md` y `docs/source-inventory.md`.
