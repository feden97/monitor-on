# Laboratorio de convenciones y calendarios

Entrega local del 28/10/2026. Continúa el incremento de calidad anterior y conserva la arquitectura de React/Vite. Los documentos y calendarios se revisaron con la información disponible el 27/10/2026; no se presupone vigencia indefinida ni se publicaron cambios en Vercel.

## Implementado

- Laboratorio interactivo dentro de la ficha de YM34D: precio fijo editable, fecha de liquidación, precio limpio/sucio, base de nominal original/residual, convención de devengamiento y convención de descuento.
- Normalización del precio a USD por VN original 100 antes del cálculo. Un precio limpio suma el corrido del escenario; una cotización sobre residual se escala por el capital pendiente según el cronograma original asumido cumplido.
- Comparación manteniendo iguales precio sucio, flujos y liquidación: ACT/360, ACT/365F, 30E/360, 30U/360 con ajuste de fin de febrero y 30/360 Bond Basis. El devengamiento del caso YPF se limita a variantes de la familia contractual 30/360; las variantes permanecen como supuestos explícitos.
- Utilidad de días con reglas y opciones explícitas, fechas civiles estrictas y tratamiento de años bisiestos y finales de mes. El motor principal utiliza esa misma utilidad; los valores históricos `360` y `365` conservan sus interpretaciones previas de 30E/360 y ACT/365F como supuestos.
- Calendario bancario argentino 2026 y New York Fed 2026–2027 con versiones, fuentes y cobertura explícita. Composición de calendarios, ajustes y suma de días hábiles sin inventar fechas fuera del rango conocido.
- Liquidación automática de referencia T+1 hábil con calendario `AR-BANK`; sigue siendo un supuesto de la aplicación, separado del plazo del proveedor. Fuera de cobertura no se fabrica una fecha. El antiguo helper se conserva para compatibilidad, pero el hook de la aplicación usa la referencia nueva.
- Contrato de YM34D versión 1.1.0: evidencia del requisito conjunto de bancos abiertos en Nueva York/Buenos Aires y registro el día calendario anterior al cupón contractual. La variante exacta 30/360 y la regla de desplazamiento siguen desconocidas.
- Eliminación de la fecha ajustada sin respaldo en la tabla, ficha y nuevos snapshots de YM34D. El 17/01/2027 contractual permanece visible; no se afirma pago el 18 ni el 19. El laboratorio separa Following hipotético de las condiciones documentadas y deja el ajuste desconocido sin cobertura conjunta.
- Descarga y reproducción de escenarios manuales, manteniendo compatibilidad numérica con los snapshots del motor 2.0.0. La versión del motor actual es 2.1.0.

## Corrección financiera adicional

Con 30E/360, el 30 y el 31 de enero pueden tener igual conteo de días. El motor clasificaba el último cupón por ese conteo; para una liquidación el 31 podía conservar el cupón del período anterior y devolver corrido 4 en vez de 0. Ahora clasifica y ordena por fecha civil, y calcula la fracción de interés por la convención elegida. Hay una prueba de regresión con fuente desordenada.

## Resultado reproducible

Escenario de flujos originales de YM34D, precio sucio 109,05 por VN original 100, liquidación fijada 28/10/2026, sin rescate ni gastos:

| Descuento | TIR efectiva anual |
| --- | ---: |
| ACT/360 | 6,921202133% |
| ACT/365F | 7,020628543% |
| 30E/360 | 7,028521439% |

Esto demuestra el efecto de cambiar una convención sobre entradas iguales; no adjudica cuál plataforma externa es correcta ni certifica una cotización actual. Las medidas nominales semestrales aparecen aparte en la interfaz.

También se probó desde el navegador un precio limpio 100, liquidación 28/10/2026, devengamiento 30E/360 y descuento ACT/365F. El precio sucio normalizado fue 102,314583333 y la TEA 8,406221911%. El archivo descargado se reprodujo desde Node sin diferencias en TIR y sensibilidades:

```powershell
npm run replay -- research/fixed-income/output/ym34d-manual-clean-act365-2026-10-28.json
```

## Comprobaciones

- 100 pruebas JavaScript y cinco Python aprobadas; lint y compilación de producción satisfactorios.
- Pruebas nuevas de convenciones, calendarios conjuntos, cobertura, precio limpio/sucio, residual/original, independencia de zona horaria, liquidación de referencia, rechazo en fecha de registro/pago y compatibilidad de snapshots anteriores.
- Se conserva el caso anterior de 109,05 bajo 30E/360; las entradas nuevas modifican resultados de forma explícita.
- Catálogo: 243 registros, cero claves duplicadas; no se cambiaron sus condiciones económicas.
- Navegador: edición de precio/fecha, selección de convenciones, recálculo del corrido, conversión de precio limpio y descarga/reproducción del escenario.

## Límites y siguiente trabajo

La cobertura argentina de 2027 no se obtuvo de una fuente bancaria oficial completa y permanece ausente. New York Fed es una referencia operativa, no una equivalencia automática del calendario de todos los bancos comerciales. Los calendarios y las cláusulas del bono tienen revisiones independientes; el laboratorio no habilita rankings validados.

Las fechas de descuento del escenario son las contractuales sin ajustar. Se asume el cumplimiento de los pagos anteriores; no se modela una operación concreta de entrega/titularidad, incumplimiento o eventos posteriores. Se bloquean las liquidaciones en la fecha contractual de registro o cupón; resolver todas las situaciones cercanas a un traslado requiere reglas de liquidación y derecho al cobro adicionales.

El siguiente avance documental es localizar el contrato de fideicomiso que el suplemento señala como prevalente y completar la regla de desplazamiento. La integración de un proveedor que informe hora del último negocio, naturaleza/base del precio y plazo sigue pendiente. YTC, YTW, make-whole y comparación autenticada de proveedores tampoco se presentan como implementados.

Fuentes y referencias exactas: [calendarios](CALENDARIOS.md), [convenciones de días](CONVENCIONES_DIAS.md), [cláusulas de YPF](YPF_CONVENCIONES.md). El primer incremento queda documentado como estado histórico en [calidad v1](IMPLEMENTACION_CALIDAD_V1.md).
