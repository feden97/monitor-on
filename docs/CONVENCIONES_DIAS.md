# Convenciones explícitas de días

Revisión del 27/10/2026. `src/utils/dayCount.js`, versión `day-count-1.0.0`, acepta fechas civiles ISO y una convención identificada. No deduce una variante a partir del denominador 360.

| Identificador | Tratamiento |
| --- | --- |
| `ACT/360` | Días reales, divisor fijo 360. |
| `ACT/365F` | Días reales, divisor fijo 365, incluido año bisiesto. |
| `30E/360` | Variante europea con ajuste de los días 31. |
| `30/360-BOND` | Bond Basis/ISDA 4.16(f), sin regla de fin de febrero. |
| `30U/360` | Variante estadounidense; requiere `endOfMonth: true` o `false`. |
| `30U/360-EOM` | Variante estadounidense con regla de fin de febrero aplicada explícitamente. |

La elección EOM pertenece a la convención del cronograma. La variante europea no es `30E/360 ISDA` alemana, que aquí no está implementada. La regla “año de 360 días, doce meses de 30 días” no resuelve por sí sola esos extremos.

API:

```js
yearFraction('2026-02-28', '2026-03-31', '30U/360', { endOfMonth: true })
// 30 / 360
dayCountDays('2026-02-28', '2026-03-31', '30E/360')
// 32
```

Las fechas invertidas se rechazan. No se presume antisimetría de reglas estadounidenses; un consumidor que necesite tiempos históricos debe definir expresamente su política de signo. Los cálculos son independientes de huso horario y calendario hábil. No determinan el derecho al cupón ni seleccionan una convención contractual.

Fuentes primarias técnicas consultadas: [documentación oficial de Strata](https://strata.opengamma.io/day_counts/), [implementación oficial](https://github.com/OpenGamma/Strata/blob/main/modules/basics/src/main/java/com/opengamma/strata/basics/date/StandardDayCounts.java) y [casos de prueba oficiales](https://github.com/OpenGamma/Strata/blob/main/modules/basics/src/test/java/com/opengamma/strata/basics/date/DayCountTest.java). La documentación relaciona ACT/360, ACT/365F, Bond Basis y europea con las secciones 4.16(e), (d), (f) y (g) de ISDA 2006, respectivamente. No se descargó ni se reprodujo ese documento comercial.

Pruebas: años bisiestos, fin de mes y febrero, variantes EOM, intervalos regulares de YPF, cambios de horario, fechas inválidas y fechas invertidas. Ejecutar `node --test --test-isolation=none tests/dayCount.test.js`.
