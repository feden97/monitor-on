# Área de candidatos a revisión

Las extracciones se guardan aquí; no modifican el catálogo operativo. El comando local

```powershell
node scripts/catalog-candidate.mjs ruta/al/candidato.json
```

archiva el JSON original, calcula SHA-256 y genera un informe `*.review.json`. La versión inicial recibe un objeto con `schemaVersion: 1`, `scope: "original-issuance"`, `instrumentId`, `proposedTerms`, `documents` y `evidence`.

`proposedTerms` contiene `issueDate`, `maturityDate`, `annualCouponRate` decimal, `frequency`, `currency` y `cashflows` con `date`, `interest_pct`, `amortization_pct` por VN original 100. Cada documento declara `id`, `url` HTTPS, `sha256` y cantidad de `pages`. Cada evidencia declara `fields`, `documentId` y `pdfPages` ordinales desde 1. La revisión comprueba estructura, evidencia declarada y conservación del capital original; no lee ni confirma el contenido del PDF.

Incluso un candidato estructuralmente válido queda con `reviewStatus: pending-review` y `publishable: false`. No existe una ruta de publicación automática ni un comando que reemplace el catálogo. Ampliaciones, reestructuraciones y otras clases de cambios necesitan modelos específicos y revisión antes de admitirse.

Este paso prepara una ingesta sostenible; todavía no descubre emisiones nuevas, programa descargas ni ejecuta OCR. Los conectores futuros deben entregar candidatos con su evidencia en este mismo flujo de revisión.
