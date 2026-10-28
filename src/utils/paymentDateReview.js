/** Presentation never certifies the legacy weekend adjustment as a contract rule. */
export function displayedPaymentDate(flow) {
  return flow && Object.hasOwn(flow, 'displayAdjustedDate') ? flow.displayAdjustedDate : flow?.date ?? null
}

export function applyPaymentDateReview(metrics, contract) {
  if (!metrics?.futureFlows || !contract?.paymentConvention) return metrics
  // Current YPF evidence identifies the centers and record date, but not the
  // ordinary payment-roll rule. Keep legacy internals for valuation compatibility
  // while removing the unsupported displayed/archived adjusted date.
  return { ...metrics, futureFlows: metrics.futureFlows.map(flow => ({ ...flow,
    displayAdjustedDate: null, paymentDateStatus: 'not-verified',
    paymentDateReason: 'Regla contractual de traslado y cobertura conjunta todavía sin verificar.',
  })) }
}
