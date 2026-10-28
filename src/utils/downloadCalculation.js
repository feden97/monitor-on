export function downloadCalculation(snapshot, symbol) {
  const blob = new Blob([`${JSON.stringify(snapshot, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${String(symbol || 'bono').replace(/[^a-zA-Z0-9_-]/g, '')}-calculo-${snapshot.settlementDate || 'escenario'}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
