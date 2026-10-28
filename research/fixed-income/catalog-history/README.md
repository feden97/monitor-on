# Resolución conservadora de claves duplicadas

27/10/2026. El archivo `catalog-before-2026-10-27.json` conserva exactamente los bytes del catálogo previo a resolver duplicados, con SHA-256 `f743ec4907bf4d2a517b90892b8c8a3835235fb715a4abcbe5d5fb1fc4057820`.

Se eliminaron las primeras apariciones de cinco nombres repetidos: YM34D, YM39D, YMCID, YMCJD y CS51D. Se preservó el objeto que la aplicación ya utilizaba después de `JSON.parse`, sin fusionar ni elegir condiciones contractuales nuevas. La prueba compara todos los campos de los 243 registros efectivos anteriores y actuales.

`deduplication-2026-10-27.json` contiene cada aparición original, su línea, el valor de cada campo y la decisión explícita. Mantener el último objeto es una decisión de compatibilidad; no certifica su exactitud financiera. Los campos presentes únicamente en definiciones anteriores permanecen desconocidos. En particular:

- No se heredan banderas `callable: false` de las primeras definiciones de YPF.
- CS51D conserva los pagos del último objeto y su falta de metadatos efectivos. El vencimiento y demás campos de la primera definición quedan archivados para revisión documental, sin incorporarlos automáticamente.
- Las condiciones originales revisadas de YM34D viven en `src/data/contracts.js`, con versión, alcance y evidencia propios. No se mezclan con rating, monto circulante o datos de mercado sin revisar.

`node scripts/catalog-source.mjs` rechaza claves repetidas antes de aceptar el catálogo. La migración `scripts/catalog-deduplicate.mjs` conserva una copia con creación exclusiva, verifica que no cambien valores efectivos y no hace nada cuando ya no existen duplicados. No debe usarse como procedimiento automático para resolver discrepancias futuras: una nueva migración requiere revisión explícita de las decisiones.
