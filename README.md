# ONs Terminal — Obligaciones Negociables

Panel para consultar cotizaciones de ONs argentinas, comparar instrumentos y revisar métricas y flujos de fondos.

## Desarrollo

Con Node.js 24 LTS y npm:

```bash
npm ci
npm run dev
```

Abrir http://localhost:5173. Vite configura proxies locales a data912, CriptoYa y ArgentinaDatos.

## Validación

```bash
npm test
npm run catalog:check
npm run lint
npm run build
```

Las pruebas usan el ejecutor nativo de Node, sin dependencias adicionales. Incluyen los ejemplos del laboratorio, controles de calidad y reproducción de snapshots. Si Windows restringe la creación de procesos, usar `npm run test:inprocess`. La compilación genera `dist/`.

## Arquitectura

- React 19, Vite 8 y Tailwind CSS 4.
- `src/lib/resourceFetcher.js`: solicitudes deduplicadas, validación, timeout y cancelación.
- `src/hooks/usePollingResource.js`: integración React; conserva datos válidos ante errores, pausa consultas periódicas en pestañas ocultas y actualiza al volver.
- `src/utils/marketData.js`: normalización de cotizaciones, MEP y riesgo país.
- `src/utils/fixedIncomeMath.js`: funciones canónicas de precio/TIR, equivalencias de tasas y sensibilidades, compartidas con el laboratorio.
- `src/utils/bondEngine.js`: fechas civiles, flujos, cupón corrido y adaptación al motor matemático.
- `src/utils/bondQuality.js`: estados independientes de contrato, cronograma, cotización, calendario y cálculo.
- `src/utils/dayCount.js`: ACT/360, ACT/365F y variantes de 30/360 con reglas explícitas.
- `src/utils/businessCalendar.js`: calendarios versionados, cobertura, composición de centros y ajustes.
- `src/utils/bondScenario.js`: escenarios manuales reproducibles para YM34D, separados de cotizaciones y rankings.
- `src/data/contracts.js`: versiones de condiciones originales revisadas con documentos y evidencia por campo. YM34D es el primer caso.
- `src/utils/bondModel.js` y `src/hooks/useBondMarketModel.js`: snapshot compartido entre Inicio, Análisis, cobertura y detalle; reutiliza métricas mientras precio, prospecto y fecha de liquidación no cambian.
- Análisis y detalle se cargan al abrirlos mediante importaciones dinámicas.
- `server/proxy.js`: lógica común de las funciones de Cloudflare Pages en `functions/`.

## Actualización de datos

Las cotizaciones se consultan cada 10 segundos; MEP cada 60 segundos y riesgo país cada 5 minutos mientras la pestaña está visible. El refresco manual comparte solicitudes en curso. La hora de consulta no certifica la hora del último negocio. Una marca de mercado ausente sigue desconocida; una marca explícita se evalúa con un umbral operativo de 30 minutos. Las fechas y horas de la interfaz siguen el mercado de Buenos Aires.

Los proxies de producción cachean GET públicos durante 10, 30 y 300 segundos respectivamente. Los POST evitan la caché. No se reenvían cookies ni credenciales del sitio a los proveedores. Los fallos de caché permiten seguir consultando el origen.

En Vercel, `vercel.json` configura la compilación y los rewrites externos de `/api/`, `/cripto/` y `/argdata/`. Vercel no ejecuta las funciones de Cloudflare en `functions/` ni aplica `public/_redirects`; los límites de tiempo y caché del helper descritos arriba corresponden a Cloudflare. Los rewrites de Vercel usan el comportamiento de proxy de esa plataforma y las cabeceras del proveedor.

Para desplegar en Cloudflare Pages se necesitan `dist/`, las funciones de `functions/` y su helper de `server/`. `vite preview` sirve el resultado estático; no ejecuta las funciones de Cloudflare ni los proxies de desarrollo.

## Alcance de los cálculos

La liquidación automática es una referencia T+1 hábil bajo AR-BANK; el plazo del proveedor sigue sin confirmar. Fuera de cobertura no se estima. El catálogo conserva los supuestos 360 → 30E/360 y 365 → ACT/365F; los campos explícitos `accrualDayCount` y `discountDayCount` permiten distinguir devengamiento y descuento. Una convención desconocida no se completa. La TIR usa fechas teóricas y las sensibilidades identifican su tasa efectiva o nominal. El solver acota iteraciones y devuelve ausencia de resultado si no converge.

Los cronogramas incompletos o contradictorios no generan rendimientos ni sensibilidades. Un cronograma agotado no declara vencido un contrato cuya fecha declarada es futura. Los datos desconocidos permanecen ausentes. Un precio conocido como limpio o sobre nominal residual necesita normalización antes de calcular con flujos por VN original 100.

El calendario antiguo termina el 01/01/2026 y se conserva para compatibilidad de helpers. Las referencias nuevas cubren Argentina bancaria 2026 y New York Fed 2026–2027. No hay cobertura conjunta argentina/NY de 2027 ni regla de traslado de YM34D certificada; sus fechas ajustadas quedan sin verificar. Los cálculos indicativos se excluyen de rankings comparables. La revisión original no certifica eventos posteriores, ratings o cotizaciones. No hay YTC/YTW habilitadas.

Las cinco claves duplicadas fueron resueltas preservando exactamente los valores efectivos de los 243 registros; el respaldo y las decisiones están en `research/fixed-income/catalog-history/`. No se completaron condiciones por inferencia. `scripts/sync-spreadsheet.py` ahora escribe candidatos a revisión, sin reemplazar el catálogo operativo. Otros scripts históricos de actualización todavía requieren migración antes de automatizarlos.

## Reproducir una ficha

Desde la ficha, descargar el cálculo JSON y ejecutar:

```powershell
npm run replay -- ruta/al/archivo-calculo.json
```

Reproduce TIR y sensibilidades con el precio y los tiempos archivados, sin APIs ni el reloj actual. No certifica las hipótesis, el contrato o el devengamiento. El acceso “Caso YM34D” conserva la evidencia documental disponible aunque el proveedor de cotizaciones falle.

La ficha incluye un laboratorio de precio limpio/sucio, nominal original/residual y convenciones independientes. Su resultado no reemplaza el dato de mercado. Estado actual y pendientes: `docs/IMPLEMENTACION_CONVENCIONES_V2.md`; el incremento anterior está en `docs/IMPLEMENTACION_CALIDAD_V1.md`.

Fuentes: data912.com, CriptoYa y ArgentinaDatos. Uso informativo.
