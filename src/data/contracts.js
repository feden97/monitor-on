/**
 * Versioned evidence for ORIGINAL issuance terms. A reviewed original contract
 * does not certify current quotes, ratings, outstanding amount or later events.
 */

const documents = [
  {
    id: 'ypf-xxxiv-results-2025-01-08',
    title: 'Aviso de resultados',
    url: 'https://inversores.ypf.com/documents/emisiones/internacionales/YPF-Aviso-de-Resultados-ON-Clase-XXXIV.pdf',
    localPath: '/documents/ypf-xxxiv/ypf-clase-xxxiv-aviso-resultados-2025.pdf',
    publishedDate: '2025-01-08', retrievedDate: '2026-10-27', pages: 3, bytes: 692722,
    sha256: '623158038c028f8eb9c4392e7bd608ba8f621d75e3fccdd5f4bf5cb1f1ec700f',
  },
  {
    id: 'ypf-xxxiv-subscription-2025-01-02',
    title: 'Aviso de suscripción',
    url: 'https://inversores.ypf.com/documents/emisiones/internacionales/YPF-Aviso-de-Suscripcion-ON-XXXIV-Internacional.pdf',
    localPath: '/documents/ypf-xxxiv/ypf-clase-xxxiv-aviso-suscripcion-2025.pdf',
    publishedDate: '2025-01-02', retrievedDate: '2026-10-27', pages: 5, bytes: 441030,
    sha256: 'b9ab05c2ae2ce59c56c984fb5ad074142c15e9a2fd02bbcd2fe6b1c2e0f04471',
  },
  {
    id: 'ypf-xxxiv-supplement-2025-01-02',
    title: 'Suplemento de prospecto',
    url: 'https://inversores.ypf.com/documents/emisiones/internacionales/YPF-Suplemento-ON-XXXIV-Internacional.pdf',
    localPath: '/documents/ypf-xxxiv/ypf-clase-xxxiv-suplemento-2025.pdf',
    publishedDate: '2025-01-02', retrievedDate: '2026-10-27', pages: 123, bytes: 1561823,
    sha256: '6eaa2ed3fc139ab05713b8ca164fe2b6e6041300201ab81b051dd609be215cce',
  },
]

const amortization = [
  { date: '2032-01-17', originalPrincipal: 30 },
  { date: '2033-01-17', originalPrincipal: 30 },
  { date: '2034-01-17', originalPrincipal: 40 },
]

// This specific regular fixed-rate schedule is supported by results items 3,7,8.
// Coupons are applied to OPENING outstanding principal, before amortization.
const cashflows = []
let principal = 100
for (let year = 2025; year <= 2034; year++) {
  for (const monthDay of ['01-17', '07-17']) {
    const date = `${year}-${monthDay}`
    if (date < '2025-07-17' || date > '2034-01-17') continue
    const amortizationPct = amortization.find(payment => payment.date === date)?.originalPrincipal ?? 0
    cashflows.push({ date, amortization_pct: amortizationPct, interest_pct: principal * 0.0825 / 2 })
    principal -= amortizationPct
  }
}

const ypfXXXIV = {
  version: '1.1.0',
  id: 'ypf-international-xxxiv-2025-01-17',
  instrumentId: 'ypf-international-xxxiv-2025-01-17',
  reviewStatus: 'reviewed-original',
  reviewDate: '2026-10-27',
  reviewScope: 'Condiciones originales de emisión y flujos teóricos sin rescate. No certifica eventos posteriores, calendario de pagos ajustado, cotización, rating ni monto circulante actual.',
  issuer: 'YPF S.A.',
  class: 'XXXIV',
  issueDate: '2025-01-17',
  maturityDate: '2034-01-17',
  currency: 'USD',
  amountBasis: 'per-100-original-face',
  annualCouponRate: 0.0825,
  frequency: 2,
  firstCouponDate: '2025-07-17',
  couponMonthDays: ['01-17', '07-17'],
  dayCountFamily: '30/360',
  dayCountEvidence: 'Año de 360 días compuesto por doce meses de treinta días. No determina por sí solo todas las reglas de fin de mes ni la convención de rendimiento de mercado.',
  couponDayCount: {
    family: '30/360',
    variant: null,
    familyReviewStatus: 'reviewed-original',
    variantReviewStatus: 'not-reviewed',
  },
  paymentConvention: {
    businessDayCenters: ['AR-BANKS', 'US-NY-BANKS'],
    businessDayDefinitionReviewStatus: 'reviewed-original',
    businessDayDefinition: 'Bancos abiertos para operar tanto en Nueva York como en la Ciudad Autónoma de Buenos Aires, excluyendo sábados y domingos.',
    businessDayAdjustment: null,
    adjustmentReviewStatus: 'not-reviewed',
    additionalInterestForRoll: null,
    rollInterestReviewStatus: 'not-reviewed',
    recordDate: {
      offsetDays: -1,
      basis: 'calendar',
      reference: 'contractual-interest-payment-date',
      reviewStatus: 'reviewed-original',
      note: 'Día anterior a la Fecha de Pago de Intereses pertinente, sea o no día hábil. La asignación operativa al comprador necesita plazo, registros y reglas de liquidación.',
    },
    note: 'Definir Día Hábil no prueba por sí solo la regla de traslado del pago. No se localizó una cláusula expresa de Following ni de interés adicional por traslado en los documentos revisados.',
  },
  businessDayCalendarReviewStatus: 'not-reviewed',
  isinRegS: 'USP989MJBY67',
  isin144A: 'US984245BB55',
  identifiers: [
    { scheme: 'ISIN', placement: 'Reg S', value: 'USP989MJBY67' },
    { scheme: 'ISIN', placement: '144A', value: 'US984245BB55' },
  ],
  // Species relationships originate in the local catalog, not the ISIN clause.
  species: [
    { ticker: 'YM34D', quoteCurrency: 'USD', mappingSource: 'local-catalog', reviewStatus: 'unverified' },
    { ticker: 'YM34O', quoteCurrency: 'ARS', mappingSource: 'local-catalog', reviewStatus: 'unverified' },
  ],
  amortization,
  cashflows,
  optionalRedemption: {
    makeWholeBefore: '2029-01-17',
    makeWholeTreasurySpreadBps: 50,
    makeWholeDescription: 'Antes del 17/01/2029: cláusula make-whole con tasa del Tesoro +50 pb, piso de par e intereses según el aviso. Requiere implementar la fórmula contractual completa.',
    fixedPricePeriods: [
      { fromInclusive: '2029-01-17', toExclusive: '2030-01-17', pricePer100Outstanding: 104.125 },
      { fromInclusive: '2030-01-17', toExclusive: '2031-01-17', pricePer100Outstanding: 102.063 },
      { fromInclusive: '2031-01-17', toExclusive: '2034-01-17', pricePer100Outstanding: 100 },
    ],
    status: 'terms-recorded-not-calculated',
    note: 'YTC/YTW y ejercicio de rescates no implementados; otras disposiciones requieren revisión integral del suplemento.',
  },
  ratingReviewStatus: 'unverified',
  subsequentEventsReviewStatus: 'not-reviewed',
  outstandingAmountReviewStatus: 'not-reviewed',
  documents,
  evidence: [
    { fields: ['issueDate', 'maturityDate', 'annualCouponRate', 'frequency', 'firstCouponDate', 'couponMonthDays', 'amortization', 'cashflows'],
      documentId: 'ypf-xxxiv-results-2025-01-08', pdfPages: [1], items: [3, 5, 6, 7, 8] },
    { fields: ['optionalRedemption'], documentId: 'ypf-xxxiv-results-2025-01-08', pdfPages: [1, 2], items: [9] },
    { fields: ['isinRegS', 'isin144A', 'identifiers'], documentId: 'ypf-xxxiv-results-2025-01-08', pdfPages: [2], items: [11] },
    { fields: ['currency'], documentId: 'ypf-xxxiv-subscription-2025-01-02', pdfPages: [2], items: [9] },
    { fields: ['dayCountFamily', 'dayCountEvidence'], documentId: 'ypf-xxxiv-subscription-2025-01-02', pdfPages: [2], items: [18] },
    { fields: ['couponDayCount', 'paymentConvention'], documentId: 'ypf-xxxiv-supplement-2025-01-02', pdfPages: [67, 81],
      sections: ['Vencimiento y pago de capital e intereses', 'Ciertas definiciones: Día Hábil'] },
  ],
}

function freezeRecursively(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeRecursively)
    Object.freeze(value)
  }
  return value
}

export const auditedContracts = freezeRecursively({ YM34D: ypfXXXIV })
