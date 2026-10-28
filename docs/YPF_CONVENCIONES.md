# Convenciones documentadas de YPF Clase XXXIV internacional

Revisión del 27/10/2026 del suplemento de prospecto de 02/01/2025 y avisos originales conservados. ISIN Reg S `USP989MJBY67`; emisión 17/01/2025; vencimiento 17/01/2034. Las páginas son ordinales del PDF desde 1.

## Conclusión implementable

La definición contractual de día hábil exige apertura bancaria conjunta en Nueva York y Buenos Aires. Un calendario argentino único es insuficiente para esta definición. Se pudo documentar esa definición y la fecha de registro; no se pudo certificar una regla de traslado de pagos ni una variante completa de 30/360. Esos campos conservan valor desconocido.

| Campo | Evidencia | Estado |
| --- | --- | --- |
| Centros de día hábil | Suplemento PDF 81, “Ciertas definiciones”: Nueva York y Ciudad Autónoma de Buenos Aires, con exclusión de sábado y domingo. | Definición original revisada. La cobertura anual de cada calendario es una comprobación independiente. |
| Base de intereses | Suplemento PDF 67, “Vencimiento y pago de capital e intereses”; aviso de suscripción PDF 2, ítem 18: año de 360 días y doce meses de treinta. | Familia 30/360 revisada. No identifica explícitamente 30E/360, 30U/360 ni todas las reglas de fin de mes. |
| Fecha de registro | Suplemento PDF 67, sección citada: día anterior a la Fecha de Pago de Intereses, incluso inhábil. Resumen PDF 21 y aviso de suscripción ítem 17 coinciden. | Regla original revisada. No sustituye la comprobación de titularidad/entrega/liquidación en la operación concreta. |
| Traslado por día inhábil | No se localizó cláusula expresa de Following, Modified Following o similar en los tres documentos originales revisados. | Desconocido. No inferir Following de la definición de día hábil. |
| Interés por demora de ajuste hábil | No se localizó una cláusula general expresa que fije si se devenga o no interés durante el traslado por inhábil. La cláusula de cese de intereses en rescate de PDF 69 tiene otro objeto. | Desconocido. No trasladar una cláusula de rescate a pagos ordinarios. |
| Prelación documental | Suplemento PDF 66, inicio de “Descripción de las obligaciones negociables”: el resumen se subordina al contrato de fideicomiso, que prevalece ante contradicciones. | Revisada. Obtener y revisar ese contrato es el siguiente paso para resolver los campos pendientes. |

## Qué significa para enero de 2027

El 17/01/2027 cae domingo. El calendario de la Reserva Federal de Nueva York publica el 18/01/2027 como feriado de Martin Luther King Jr. Bajo un **escenario explícito de Following** y con apertura confirmada en ambos centros, el 18 no sería una fecha hábil conjunta. El 19 sería candidato si ambos centros estuvieran abiertos.

Eso no acredita todavía que el pago contractual corresponda efectivamente al 19: faltan la cláusula de traslado y la cobertura bancaria argentina de 2027. La interfaz debe conservar la fecha contractual y mostrar el resultado como escenario o dato pendiente, sin certificar una fecha ajustada que excede la evidencia disponible.

La fecha de registro ordinaria que se deriva del texto para el cupón contractual del 17 sería el 16/01/2027, aunque sea sábado. No autoriza a suponer que toda compra liquidada antes de un traslado del pago adquiere ese cupón.

## Modelo actualizado

La versión `1.1.0` de `src/data/contracts.js` agrega `couponDayCount` y `paymentConvention`. Se conserva `reviewStatus: reviewed-original` y `businessDayCalendarReviewStatus: not-reviewed`. Los eventos posteriores, relación operativa de especies, calificaciones, plazo de mercado y monto circulante actual siguen sin certificarse.

Los campos `businessDayAdjustment`, `additionalInterestForRoll` y `couponDayCount.variant` son `null`; su ausencia no se reemplaza con un valor por defecto documentado como hecho. `paymentConvention.recordDate` almacena el desfase de un día calendario respecto de la fecha contractual de intereses.

## Fuentes y límites de búsqueda

- [Suplemento oficial de YPF](https://inversores.ypf.com/documents/emisiones/internacionales/YPF-Suplemento-ON-XXXIV-Internacional.pdf), copia conservada: `research/fixed-income/documents/ypf-clase-xxxiv-suplemento-2025.pdf`, SHA-256 `6eaa2ed3fc139ab05713b8ca164fe2b6e6041300201ab81b051dd609be215cce`. Se extrajo texto del documento completo y se inspeccionaron visualmente las páginas 66, 67 y 81.
- [Aviso de suscripción oficial](https://inversores.ypf.com/documents/emisiones/internacionales/YPF-Aviso-de-Suscripcion-ON-XXXIV-Internacional.pdf), copia conservada e identificada en el manifiesto original.
- [Aviso de resultados oficial](https://inversores.ypf.com/documents/emisiones/internacionales/YPF-Aviso-de-Resultados-ON-Clase-XXXIV.pdf), fija las fechas y condiciones finales de la emisión original.
- [Calendario de la Reserva Federal de Nueva York](https://www.newyorkfed.org/aboutthefed/holiday_schedule.html), el calendario es evidencia del cierre de esa institución; su adecuación como calendario operativo de bancos comerciales requiere criterio explícito.
- Se consultaron el índice de emisiones del emisor, búsquedas acotadas en fuentes oficiales y el [Form 20-F de YPF 2024 en SEC](https://www.sec.gov/Archives/edgar/data/904851/000119312525067155/d866694d20f.htm). No se obtuvo un contrato de fideicomiso específico que permita resolver el traslado. “No localizado en esta revisión” no significa “la cláusula no existe”.

No se revisó exhaustivamente la totalidad de eventos posteriores ni se verificó un aviso de pago de enero de 2027. Ninguna plataforma comparativa se tomó como autoridad para completar el contrato.
