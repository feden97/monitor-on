# Calendarios bancarios versionados

Revisión: 27/10/2026. Los calendarios especifican una cobertura completa de fechas civiles para las fuentes y el alcance indicados. La última fecha de feriado no define la cobertura. Las versiones reflejan información publicada al momento de revisión; cierres extraordinarios posteriores pueden requerir una nueva versión.

| Identificador | Fuente y cobertura | Límite de interpretación |
| --- | --- | --- |
| `AR-BANK` · `2026.10.27-1` | Calendario BCRA 01/01/2026–31/12/2026, con modificaciones conocidas y Día del Bancario. | Entidades financieras argentinas; no certifica un calendario de negociación/liquidación de una bolsa ni el contrato de cada bono. |
| `US-NY-FED` · `2026.10.27-1` | Federal Reserve Bank of New York, 01/01/2026–31/12/2027. | Operación de New York Fed; no es NYSE ni prueba por sí sola la apertura de todos los bancos comerciales exigidos por un contrato. |

## Fuentes primarias y decisiones

El [listado bancario de BCRA](https://www.bcra.gob.ar/consulta-feriados-bancarios/) incorpora la [Comunicación C 101352](https://www.bcra.gob.ar/archivos/Pdfs/comytexord/C101352.pdf), anexo PDF 2, y las modificaciones [C 102390](https://www.bcra.gob.ar/archivos/Pdfs/comytexord/C102390.pdf) y [A 8487](https://www.bcra.gob.ar/archivos/Pdfs/comytexord/A8487.pdf). Se incluyen los días turísticos que BCRA identifica para las entidades financieras y los cierres extraordinarios del 9 y 10 de noviembre de 2026. El 6 de noviembre se incorpora por la [regla anual del Día del Bancario publicada por BCRA](https://www.bcra.gob.ar/noticias/miercoles-06-11-dia-de-las-trabajadoras-y-trabajadores-bancarios/); cada fecha conserva los identificadores de su evidencia.

La tabla BCRA consultada ofrece 2026 y años anteriores. No se localizó un calendario bancario oficial completo de 2027 durante esta revisión. No se extrapolan los feriados móviles, turísticos ni cierres extraordinarios. Por eso `AR-BANK` rechaza 2027 y un calendario conjunto Argentina/Nueva York tampoco puede ajustar ese año.

El [calendario de New York Fed](https://www.newyorkfed.org/aboutthefed/holiday_schedule.html), columnas 2026 y 2027, cierra sábados y domingos y enumera los feriados. La [tabla K.8 de la Reserva Federal](https://www.federalreserve.gov/aboutthefed/k8.htm) distingue sus bancos del Board of Governors: cuando el feriado cae en sábado, el banco abre el viernes anterior; si cae en domingo, cierra el lunes siguiente. Así, 03/07/2026, 18/06/2027 y 24/12/2027 permanecen hábiles bajo este calendario, y 05/07/2027 no. Trasladar el calendario de empleados federales o de NYSE produciría diferencias reales.

## Calendario conjunto y fechas de YPF

Un conjunto exige apertura de **todos** los centros elegidos. El 11/11/2026 puede ser hábil bajo `AR-BANK`, pero cierra New York Fed; el conjunto no es hábil. La conjunción conserva la intersección de coberturas y las versiones de cada centro.

Solo bajo el calendario `US-NY-FED`, un ajuste Following del domingo 17/01/2027 produce 19/01/2027, porque el lunes 18 es Martin Luther King Jr. Day. **No se presenta este resultado como fecha certificada de pago de YM34D.** Su contrato exige revisar definición, centros y regla de ajuste; si exige Buenos Aires además de Nueva York, el calendario argentino 2027 todavía no está cubierto en esta versión.

## API

`src/utils/businessCalendar.js` utiliza exclusivamente fechas ISO civiles `AAAA-MM-DD` y aritmética UTC. No interpreta timestamps zonificados como fechas contractuales.

```js
getCalendarCoverage(['AR-BANK', 'US-NY-FED'])
// { status: 'covered-range', from: '2026-01-01', to: '2026-12-31', calendars, notes }

isBusinessDay('2026-10-28', ['AR-BANK', 'US-NY-FED']) // true
adjustBusinessDay('2026-11-06', ['AR-BANK', 'US-NY-FED'], 'following') // '2026-11-12'
addBusinessDays('2026-11-05', 1, ['AR-BANK', 'US-NY-FED']) // '2026-11-12'
tryAdjustBusinessDay('2027-01-17', ['AR-BANK', 'US-NY-FED'])
// { date: null, status: 'out-of-coverage', ... }
```

Reglas admitidas: `following`, `modified-following`, `preceding`, `unadjusted`. Los ajustes y cada paso del avance comprueban cobertura; nunca cambian silenciosamente a “solo fines de semana”. Las funciones estrictas lanzan `RangeError` con `code: CALENDAR_OUT_OF_COVERAGE`, o códigos de entrada/calendario inválido. La variante `tryAdjustBusinessDay` ofrece ausencia explícita de resultado para la interfaz.

`addBusinessDays` excluye la fecha inicial del conteo. Cero deja la fecha sin ajustar, incluso si es inhábil; no debe confundirse con un Following. Un plazo de liquidación debe elegirse y registrarse expresamente: el módulo no presupone T+1 para todas las especies.

## Pruebas y alcance

```powershell
node --test --test-isolation=none tests/businessCalendar.test.js
```

Las pruebas cubren cierres de centros distintos, feriados bancarios/turísticos/extraordinarios, reglas de ajuste, adición hábil, diferencias con feriados de empleados federales, límites anuales, entradas inválidas e independencia de zona horaria. Las fuentes y fechas se conservan en los JSON del calendario. La capa no modifica el catálogo, no determina el derecho al cupón y no certifica reglas contractuales ni eventos futuros no publicados.
