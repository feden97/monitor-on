# Auditoría del repositorio Monitor ON

Fecha de revisión: 27 de octubre de 2026. Alcance: código y datos locales; no se certifican cotizaciones ni contratos por comparación entre páginas. Las referencias de línea corresponden al estado revisado, antes de integrar nuevas herramientas de auditoría.

**Documento histórico del diagnóstico inicial.** El código posterior incorpora controles de calidad y elimina las claves duplicadas; ver [implementación](IMPLEMENTACION_CALIDAD_V1.md). Las referencias al catálogo original corresponden a la copia conservada en `research/fixed-income/catalog-history/catalog-before-2026-10-27.json`; las de código, al estado inicial de Git `f2a4cc7`.

## Decisión tecnológica

Conservar React 19, Vite 8 y Tailwind CSS 4. La aplicación ya tiene separación de consultas, normalización, motor de cálculo, modelo compartido e interfaz. Reescribirla o migrar ahora a Next.js/Python no resolvería los problemas principales: cronogramas incompletos, falta de evidencia documental y convenciones poco explícitas.

El motor determinista puede seguir en JavaScript y ejecutarse tanto en navegador como en Node. Python resulta útil para extracción de PDF y procesos de datos; añadirlo como servicio HTTP solo cuando exista una necesidad operativa concreta. Primero conviene incorporar validación y evidencia en módulos separados y conectar después la interfaz.

## Arquitectura existente y reutilizable

| Capa | Implementación | Evaluación |
| --- | --- | --- |
| Interfaz | `src/App.jsx`, `Home.jsx`, `AnalysisTab.jsx`, `BondDetailPanel.jsx` | Tabla, filtros, detalle y temas reutilizables. Análisis y detalle se cargan bajo demanda. |
| Consultas | `src/lib/resourceFetcher.js`, `src/hooks/usePollingResource.js` | Deduplicación, timeout, cancelación, conservación de datos válidos y pausa en pestaña oculta. Buena base. |
| Mercado | `src/utils/marketData.js` | Normalización consistente, pero el modelo de cotización carece de metadatos necesarios para auditoría. |
| Modelo compartido | `src/utils/bondModel.js` | Une precios ARS/USD y reutiliza métricas por precio, prospecto y fecha de liquidación. |
| Cálculos | `src/utils/bondEngine.js` | Fechas civiles, flujos, interés corrido, TIR efectiva y duration; solver acotado con respaldo por intervalo. Reutilizable después de validar las entradas. |
| Base contractual | `src/data/bondProspectos.json` | Archivo estático heterogéneo. El nombre no implica que contenga prospectos originales ni datos verificados. |
| Proxies | `vercel.json`, `vite.config.js`, `functions/`, `server/proxy.js` | Vercel usa rewrites; las funciones con timeout/caché son de Cloudflare y no se ejecutan en Vercel. |
| Ingesta | `scripts/sync-spreadsheet.py`, `mae_monitor.py`, `update_db.*` | Prototipos aprovechables, todavía sin flujo de validación/publicación contractual. |

`src/utils/bondMath.js` es una segunda biblioteca financiera antigua y no aparece importada por la aplicación revisada. Conviene retirar o documentar ese código en una tarea posterior, evitando mantener dos fórmulas supuestamente oficiales.

## Hallazgos comprobados

### Alta prioridad: cronograma incompleto interpretado como bono vencido

`src/utils/bondEngine.js:282` devuelve `isMatured: true` si el cronograma cargado no tiene pagos futuros, sin contrastar el vencimiento contractual.

Caso reproducible: `CP39D` declara vencimiento 31/03/2028 (`src/data/bondProspectos.json:169`), pero solo incluye dos cupones de 2026 y ninguna devolución de capital (`:171`). Para liquidación 28/10/2026, `analyzeBond(100, CP39D, '2026-10-28')` devuelve `{ isMatured: true }`. Es una contradicción interna demostrada, aun sin resolver cuál es el contrato correcto. `YMCXO` presenta el mismo comportamiento con vencimiento declarado en 2031; además, su clave termina en O y el modelo principal procesa solo símbolos D, por lo que ese registro no respaldaría su especie D.

Acción recomendada: distinguir `vencido`, `cronograma incompleto`, `datos insuficientes` y `verificado`. No reconstruir pagos ni afirmar vencimiento a partir de una tabla truncada.

### Alta prioridad: claves JSON duplicadas con reemplazo silencioso

Se encontraron cinco claves de instrumento repetidas: `YM34D`, `YM39D`, `YMCID`, `YMCJD` y `CS51D`. Por ejemplo, `YM34D` aparece en `src/data/bondProspectos.json:11` y `:9451`. Al cargar JSON, prevalece la última definición; no se fusionan los objetos.

La última definición de YM34D contiene el cronograma completo con amortizaciones 30/30/40 y cupones decrecientes. Por tanto, sería incorrecto auditar solamente el primer bloque y afirmar que la aplicación utiliza sus dos pagos incompletos o su `callable: false`. El objeto efectivo pierde campos presentes en el bloque anterior; el caso CS51D también pierde metadatos de vencimiento.

Acción recomendada: detectar duplicados antes del parseo y resolver cada registro contrastando documentos. No deduplicar eligiendo automáticamente el primer o último bloque.

### Alta prioridad: ausencia de procedencia contractual por dato

En los 243 objetos de instrumento efectivos no se encontraron campos `emission_date`, ISIN ni campos de fuente, URL, documento o procedencia. Los tickers existentes permiten unir precios, pero no aportan evidencia de la tasa, amortización, rating o fecha.

`scripts/sync-spreadsheet.py:169` sustituye cronogramas con cualquier extracción no vacía y `:181` escribe directamente la base. No exige amortización coherente, cobertura temporal, revisión ni evidencia del documento. La extracción de metadatos de la pestaña principal está sin implementar (`:63`).

Acción recomendada: extraer hacia un área de candidatos; guardar fuente, fecha de consulta, contenido original/hash, página o celda y versión. Publicar al catálogo aceptado únicamente tras validación. Registrar ratings con agencia, escala y fecha; una cadena como `AAA` aislada no permite comparar riesgos.

### Prioridad media: fechas contractuales internamente incompatibles

Ejemplo: CS47D declara vencimiento 15/11/2027 (`src/data/bondProspectos.json:230`), pero el cronograma amortiza el capital en noviembre de 2028. El motor utiliza los pagos de 2028 mientras la tabla puede mostrar vencimiento de 2027. Es una contradicción del catálogo; elegir la fecha correcta requiere documento primario.

No debe confundirse una diferencia pequeña de fechas con un error probado: puede existir ajuste por día hábil. La auditoría estructural debe indicar qué regla detectó la discrepancia y conservar ambos valores.

### Prioridad media: calendario agotado

`src/data/holidays.json` termina el 01/01/2026. `getNextBusinessDay` usa exclusivamente ese calendario más fines de semana (`src/utils/bondEngine.js:42`). No hay control de cobertura de años ni calendario por plaza/contrato. Los pagos posteriores se ajustan con información incompleta.

Acción recomendada: calendarios versionados y cobertura explícita, con la plaza y regla contractual correspondientes. El calendario argentino único no es suficiente para certificar cualquier ON internacional.

## Convenciones y supuestos que requieren validación, no errores certificados

| Tema | Comportamiento actual | Qué falta documentar |
| --- | --- | --- |
| Precio | `bondModel.js:32` pasa el cierre `c` a `analyzeBond`, que lo trata como precio sucio por 100 VN (`bondEngine.js:269`). | Definición del proveedor: limpio/sucio, VN original/residual, moneda, plaza, plazo y hora de la operación. No se demuestra aquí que el dato recibido sea incorrecto. |
| Liquidación | T+1 calendario ajustado a hábil (`bondEngine.js:29`). | Especie/plazo concreto, hora de corte, calendario y operación observada. No todas las cotizaciones deben imponerse al mismo plazo. |
| Base de días | `360` selecciona 30E/360; otro denominador usa días reales (`bondEngine.js:126`). | Separar ACT/360, ACT/365F, 30E/360, 30U/360 y reglas especiales. Un denominador 360 por sí solo no identifica la convención. |
| TIR y duration | TIR efectiva anual; TNA equivalente según frecuencia; modified duration respecto de esa TNA (`bondEngine.js:304`). | Exponer la variable de tasa y base de cada sensibilidad al comparar proveedores. No confundir duration respecto de TEA con duration respecto de TNA. |
| Fecha de pago | Descuento con fecha teórica y visualización con fecha hábil (`bondEngine.js:122`). | Convención contractual, devengamiento y derecho al cobro en liquidación/fecha de corte. |
| Cupón corrido | Usa último flujo positivo o fecha de emisión (`bondEngine.js:151`). | Con cronograma parcial anterior al primer cupón y sin fecha de emisión puede dar cero por información insuficiente. Cero calculado y dato desconocido deben distinguirse. |
| Current yield | Suma intereses de los próximos 365 días / precio limpio (`bondEngine.js:291`). | Etiqueta y metodología para instrumentos amortizables, tasa escalonada o vida residual menor a un año. |
| Cotización | `marketData.js:1` conserva solo números y símbolo. | Timestamp de mercado, timestamp de recepción, moneda, mercado, plazo, origen y condición de precio. `lastUpdated` es hora de consulta, no certifica hora del último negocio. |
| Cobertura | `bondModel.js:74` mide presencia de cuatro grupos de datos. | No representa porcentaje de exactitud ni de contratos auditados; la UI llega a llamarlos «chequeados». |

El motor revisado no implementa convexidad, YTC, YTW, curva cero ni flujos CER/variables dependientes de escenarios. Su ausencia es alcance pendiente, no prueba de que la TIR fija existente sea errónea.

## Recuento estructural del catálogo revisado

| Control | Resultado |
| --- | ---: |
| Instrumentos efectivos después de `JSON.parse` | 243 |
| Apariciones de claves de instrumento en el texto | 248 |
| Nombres de instrumento duplicados | 5 |
| Sin cronograma o con cronograma vacío | 34 |
| Con cronograma no vacío | 209 |
| Cronograma no vacío sin devolución alguna de capital | 2 |
| Sin fecha de emisión en campo `emission_date` | 243 |
| Con campos de procedencia documental detectados | 0 |

Un sondeo inicial marcó 125 registros por alguna de estas condiciones: cronograma vacío, amortización total fuera de 100 ± 0,01, última fecha diferente del vencimiento. **No significa 125 errores financieros demostrados.** Puede incluir redondeos, historia parcial, faltantes de metadatos o ajustes de calendario. Para cifras operativas debe usarse el informe generado por la nueva herramienta de auditoría, con sus reglas explícitas.

## Verificación ejecutada

Se ejecutaron las 35 pruebas existentes satisfactoriamente mediante:

```powershell
node --test --test-isolation=none tests/*.test.js
```

`npm test` no pudo crear los procesos aislados del ejecutor en el sandbox de Windows (`spawn EPERM`); no fueron fallos de las aserciones financieras. La alternativa anterior ejecuta las mismas pruebas en el proceso actual.

La compilación con `npm run build` se completó correctamente después de repetirla con autorización para crear los procesos nativos de Windows que el sandbox impedía. Se transformaron 1906 módulos; el bundle principal quedó en aproximadamente 503 KB (124,5 KB gzip), con una advertencia de tamaño, sin error de compilación. No se modificaron dependencias para resolver esa restricción del entorno.

La prueba del catálogo existente comprueba ausencia de NaN/infinito (`tests/bondEngine.test.js:142`); no certifica integridad contractual. Las pruebas unitarias del solver son útiles, pero faltaban casos externos del libro, invariantes de capital y auditoría del archivo fuente antes de perder duplicados.

## Primer incremento recomendado

1. Herramienta local de auditoría del catálogo: duplicados, cronogramas, capital, vencimientos y campos de evidencia; generar resultados reproducibles sin alterar los datos originales.
2. Casos matemáticos del libro con entradas, fórmulas, convención, resultado esperado y tolerancia explícitos.
3. YM34D como ficha contractual documentada: conservar PDF oficial y evidencias por campo; comparar el cronograma efectivo actual con el calculado independientemente.
4. Integrar estados de calidad en la interfaz y bloquear métricas que dependan de un cronograma insuficiente.
5. Añadir cotizaciones versionadas y una captura comparable de cada proveedor. Solo entonces diagnosticar diferencias de TIR entre sitios.

Después de estos pasos: rediseñar la ficha y tabla con la densidad de una terminal como referencia, y escalar a otros instrumentos representativos. Una interfaz profesional puede construirse sobre la tecnología actual; la prioridad es que cada número tenga entradas y evidencia verificables.
