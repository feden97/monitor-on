# Evidencia matemática de Dumrauf

Revisión visual local del 27/10/2026 de `C:\Users\Fede\Downloads\Analisis cuantitativo de bonos-Guillermo Dumrauf.pdf` (428 páginas). El archivo está escaneado: la extracción de texto de las páginas revisadas no devuelve contenido. No se publica ni se incorpora el libro al sitio. Las páginas indicadas del PDF son ordinales desde 1; no inferir la página impresa por una resta fija.

| Referencia inspeccionada | Datos o definición | Validación implementada |
| --- | --- | --- |
| PDF 59, impresa 44, cap. 3 | Santa Emilia: bullet a cinco años, cupón anual 10%, rendimiento exigido 11%, precio informado 96,3 por cada 100 VN | Flujos 10, 10, 10, 10, 110 en tiempos 1 a 5: precio 96,30410298235068; inversión precio/TIR |
| PDF 89, impresa 75, cap. 4, ecuación 4.1 | El mismo bullet, esta vez a rendimiento 10% y precio 100: duración Macaulay informada 4,17 años | Duración ponderada de flujos; coincidencia al redondear |
| PDF 90, impresa 76, ecuación 4.2; PDF 91, impresa 77 | Duración modificada respecto de una tasa anual efectiva: Macaulay/(1+TIR); resultado publicado 3,79 | Coincidencia al redondear y verificación de la derivada por diferencias finitas |
| PDF 97, impresa 83, ecuación 4.5; PDF 98, impresa 84, ecuaciones 4.9-4.10 | Derivada segunda; el libro denomina convexity a P''/(2P), incluyendo el factor de Taylor 1/2 | Se devuelven `convexity=P''/P` y `convexityTaylorCoefficient=P''/(2P)` con nombres separados; diferencias finitas para la derivada segunda |

## Aparente errata en la fórmula de la página impresa 44

En la imagen del PDF 59, el cuarto numerador de la ecuación del precio se lee **110**. Eso es incompatible con la descripción de un bono bullet y con el precio 96,3: el capital se paga sólo al final del quinto año. La prueba usa los flujos indicados por la descripción del ejemplo, con **10** en el cuarto año. También verifica que transcribir literalmente ese 110 adicional produce un precio mayor que 160. Se registra como aparente errata de la fórmula mostrada; no se asume que todas las fórmulas del libro estén verificadas ni se busca una fe de erratas editorial.

## Alcance del laboratorio

El laboratorio exige tiempos y flujos explícitos, precio sucio, una moneda y una misma base de VN. Sólo admite flujos futuros positivos y un egreso inicial; eso permite una TIR única. No valida la completitud de un cronograma contractual ni calcula feriados, derechos al cupón, devengamiento, rescates, CER, tasas variables, defaults o gastos. Tampoco determina si una cotización externa es limpia o sucia.

Las tasas son decimales. La base de rendimiento es obligatoria: `effective-annual` o `nominal` con frecuencia indicada. La duración modificada y la convexidad dependen de esa base: no deben compararse como si fueran invariantes al transformar TEA en una tasa nominal semestral.

Pruebas reproducibles, sin instalaciones:

```powershell
node --test research/fixed-income/math.test.mjs
```

En el sandbox de Windows, la creación del subproceso del ejecutor de pruebas devolvió `spawn EPERM`; se ejecutaron las mismas doce pruebas correctamente con `node --test --test-isolation=none research/fixed-income/math.test.mjs`.

Este conjunto es una primera validación, no una certificación de todo el motor actual ni de todas las condiciones de un instrumento. Los casos analíticos, las identidades y las diferencias finitas son verificaciones independientes de las cifras redondeadas del libro.
