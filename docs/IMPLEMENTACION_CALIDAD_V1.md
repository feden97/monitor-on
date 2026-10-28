# Incremento de calidad y ficha auditable

27/10/2026. Cambios locales sobre Monitor ON. Conserva React/Vite/Tailwind y la estructura general de la terminal. La respuesta externa adjunta se tomó como comentario a evaluar; las decisiones se basaron en código, pruebas y documentos conservados.

**Estado histórico.** El incremento posterior del 28/10/2026 agrega calendarios de referencia, convenciones explícitas y laboratorio manual; ver [convenciones v2](IMPLEMENTACION_CONVENCIONES_V2.md). Los valores y pendientes de este documento describen la entrega inicial.

## Implementado

| Área | Comportamiento |
| --- | --- |
| Calidad independiente | Cada fila lleva estados y razones de contrato, cronograma, cotización, calendario y cálculo. La revisión original de YM34D queda separada de eventos posteriores y datos de mercado. |
| Bloqueo de métricas | No se calcula con cronogramas vacíos, truncados, contradictorios, capital no justificado, intervalos faltantes, cupón/frecuencia desconocidos o frontera de cobro sin resolver. No se completa ningún pago por intuición. |
| Vencimiento | Se usa la fecha declarada, con su condición de catálogo sin certificar. CP39D queda incompleto y bloqueado; no aparece vencido por falta de pagos futuros en la tabla. |
| Convenciones de precio | Un precio conocido como limpio o por nominal residual bloquea hasta normalización comprobada. Si su naturaleza es desconocida, un cronograma utilizable solo permite un escenario indicativo con el supuesto de precio sucio por VN original 100. |
| Rankings | TIR y paridad comparables requieren revisión de contrato, eventos, especie, convenciones, precio, liquidación y calendario. Las estimaciones quedan fuera; no se reemplaza el ranking con números no certificados. Actividad se presenta como dato recibido. |
| Marcas de tiempo | Consulta/recepción y último negocio son campos distintos. No se inventa hora de mercado a partir de la consulta. Una marca válida se revisa con umbral operativo explícito de 30 minutos. El día financiero y las horas visibles siguen Buenos Aires. |
| Motor canónico | Aplicación y laboratorio usan `src/utils/fixedIncomeMath.js`. El adaptador conserva explícitamente la convención de fechas, separa sensibilidad TEA/nominal y agrega convexidad. Si no hay TIR representable, desaparecen todas las métricas dependientes. |
| YM34D | Contrato original versionado con ISIN, especies asociadas pendientes de revisión, flujos y rescates registrados, documentos, páginas y SHA-256. La ficha distingue pagos contractuales y ajustes estimados, y ofrece tres PDFs oficiales descargables. |
| Reproducción | La ficha descarga JSON con entradas, flujos originales y tiempos usados, supuestos, identificación documental, versión de motor, resultados y calidad. `npm run replay -- ARCHIVO.json` reproduce TIR y sensibilidades sin APIs ni fecha actual. Un ID compacto no se presenta como firma o prueba de autenticidad. |
| Disponibilidad documental | “Caso YM34D” abre la evidencia aunque no haya respuesta del proveedor de mercado; sin precio no fabrica una valoración. |
| Duplicados | Cinco nombres duplicados eliminados conservando exactamente los valores efectivos anteriores de los 243 registros. Respaldo íntegro y decisiones por campo, con conflictos preservados. La prueba rechaza reintroducir claves repetidas. |
| Ingesta candidata | Validador local de extracciones con evidencia declarada y SHA-256; siempre queda pendiente de revisión. El importador de planillas escribe una propuesta y no reemplaza la base operativa. |

## Comprobado

- 72 pruebas JavaScript y cinco Python aprobadas. Incluyen ejemplos del libro, soluciones analíticas, derivadas numéricas, equivalencias, errores numéricos, estados, preservación del catálogo y hashes de PDFs.
- `npm run catalog:check`: 243 instrumentos y cero claves duplicadas.
- `npm run lint` y compilación de producción satisfactorias. Vite mantiene una advertencia de tamaño del paquete principal superior a 500 KB; no es un fallo de compilación.
- Navegador con datos recibidos: YM34D muestra revisión original, cálculo indicativo, hora de mercado desconocida y calendario sin cobertura. La ficha separa TEA, nominal, Macaulay, duraciones modificadas y convexidad.
- Descarga real desde la ficha y reproducción desde Node: para el snapshot observado a precio 109,05 y liquidación 28/10/2026, TEA 7,028521439%, sin diferencias entre pantalla y reproducción. Es una comprobación del escenario asumido, no una certificación de cotización ni una auditoría de las otras plataformas.
- AEC3D, sin cronograma: TIR, paridad y sensibilidades ausentes con razones de bloqueo. CP39D y CS47D cubiertos por regresiones de cronograma truncado y fechas contradictorias.
- Navegación de ficha y cierre, menú, descarga JSON y diseño revisados en anchos de 390 y 1440 píxeles. Se corrigió el cierre de la ficha que quedaba tapado por su encabezado. Evidencia visual en `docs/qa/ym34d-auditable-desktop.jpg`.

## Pendiente

1. Revisar documentos y corregir condiciones de los instrumentos bloqueados. “Estructura completa” es una validación de coherencia, no una garantía de completitud contractual: el criterio conservador también puede bloquear instrumentos con reglas especiales hasta documentarlas.
2. Calendarios completos, versionados y por centro financiero, junto con reglas de días hábiles/derechos al cupón. El calendario posterior a enero de 2026 sigue sin certificar; se expone esa limitación y no habilita rankings validados.
3. Fuente operativa que confirme hora de mercado, precio limpio/sucio, base de nominal y liquidación. El adaptador actual mantiene esos campos desconocidos cuando el proveedor no los explicita. El umbral de frescura es una política operativa, no una garantía de liquidez.
4. Revisión de eventos posteriores, ratings con agencia/escala/fecha y relaciones especie/instrumento. La evidencia de YPF cubre la emisión original.
5. YTC/YTW, make-whole, variantes adicionales de cómputo de días, CER, variables y reestructuraciones. No se publican métricas de esas capacidades pendientes.
6. Comparador numérico sincronizado entre plataformas con mismas entradas y clasificación de diferencias. El formato de snapshots prepara entradas propias; no incorpora conectores autenticados ni adjudica resultados externos.
7. Descubrimiento automático de documentos, OCR y procesos de actualización programados. La ingesta candidata es una base local para revisión. Otros scripts históricos de actualización requieren migración antes de automatizarse.
8. Publicación en Vercel y rediseño integral. Este incremento está construido y verificado localmente; no se realizó push ni despliegue.

## Reproducir las comprobaciones

```powershell
npm run test:inprocess
npm run catalog:check
npm run lint
npm run build
python -m unittest discover -s research/fixed-income -p 'test_*.py' -v
npm run replay -- research/fixed-income/output/ym34d-scenario-2026-10-28.json
```

La alternativa `test:inprocess` usa las mismas pruebas en un proceso, por las restricciones del sandbox de Windows. En un entorno normal puede usarse `npm test`.
