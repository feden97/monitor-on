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
npm run lint
npm run build
```

Las pruebas usan el ejecutor nativo de Node, sin dependencias adicionales. Cubren cálculos, fechas, reutilización de métricas, normalización de respuestas, cancelación de consultas y proxies HTTP. La compilación genera `dist/`.

## Arquitectura

- React 19, Vite 8 y Tailwind CSS 4.
- `src/lib/resourceFetcher.js`: solicitudes deduplicadas, validación, timeout y cancelación.
- `src/hooks/usePollingResource.js`: integración React; conserva datos válidos ante errores, pausa consultas periódicas en pestañas ocultas y actualiza al volver.
- `src/utils/marketData.js`: normalización de cotizaciones, MEP y riesgo país.
- `src/utils/bondEngine.js`: fechas civiles, flujos, cupón corrido, TIR y duración.
- `src/utils/bondModel.js` y `src/hooks/useBondMarketModel.js`: snapshot compartido entre Inicio, Análisis, cobertura y detalle; reutiliza métricas mientras precio, prospecto y fecha de liquidación no cambian.
- Análisis y detalle se cargan al abrirlos mediante importaciones dinámicas.
- `server/proxy.js`: lógica común de las funciones de Cloudflare Pages en `functions/`.

## Actualización de datos

Las cotizaciones se consultan cada 10 segundos; MEP cada 60 segundos y riesgo país cada 5 minutos mientras la pestaña está visible. El refresco manual comparte solicitudes en curso. La hora de actualización indica la última consulta correcta aunque los valores no cambien.

Los proxies de producción cachean GET públicos durante 10, 30 y 300 segundos respectivamente. Los POST evitan la caché. No se reenvían cookies ni credenciales del sitio a los proveedores. Los fallos de caché permiten seguir consultando el origen.

Para desplegar en Cloudflare Pages se necesitan `dist/`, las funciones de `functions/` y su helper de `server/`. `vite preview` sirve el resultado estático; no ejecuta las funciones de Cloudflare ni los proxies de desarrollo.

## Alcance de los cálculos

Se conservan las convenciones financieras existentes: liquidación al día calendario siguiente ajustado a día hábil; 30E/360 cuando el prospecto indica 360 y días reales en los demás casos. La TIR usa fechas teóricas y los pagos mostrados usan fechas hábiles. El solver limita sus iteraciones y devuelve ausencia de resultado cuando no converge.

Los cálculos dependen de los datos estáticos de `src/data/`. El calendario cargado termina el 1 de enero de 2026 y requiere actualización con fuentes verificadas para ajustar feriados posteriores. Existen cronogramas vacíos o parciales y claves repetidas en los prospectos; no se reconstruyen pagos ni se completan datos automáticamente. Las mejoras de código no validan la exactitud contractual de esos datos.

Fuentes: data912.com, CriptoYa y ArgentinaDatos. Uso informativo.
