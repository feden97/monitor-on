import { formatDate } from '../utils/formatters'
import { downloadCalculation } from '../utils/downloadCalculation'

const EVIDENCE_LABELS = {
  issueDate: 'Emisión', maturityDate: 'Vencimiento', annualCouponRate: 'Cupón',
  frequency: 'Frecuencia', firstCouponDate: 'Primer cupón', couponMonthDays: 'Fechas de cupón',
  amortization: 'Amortizaciones', cashflows: 'Flujos', optionalRedemption: 'Rescate opcional',
  isinRegS: 'ISIN Reg S', isin144A: 'ISIN 144A', identifiers: 'Identificadores',
  currency: 'Moneda', dayCountFamily: 'Base del cupón', dayCountEvidence: 'Regla de cómputo',
  couponDayCount: 'Familia y variante del cómputo', paymentConvention: 'Días hábiles y registro',
}

function priceTypeLabel(value) {
  return { dirty: 'Sucio', clean: 'Limpio', unknown: 'Sin informar', 'dirty-assumed': 'Supuesto como precio sucio' }[value] || 'Sin informar'
}

function SnapshotRow({ label, children }) {
  return <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-terminal-border/30 py-2 last:border-0"><dt className="text-terminal-muted">{label}</dt><dd className="break-all text-right font-mono text-terminal-text">{children ?? '—'}</dd></div>
}

export default function BondAuditPanel({ contract, snapshot, symbol }) {
  return (
    <div className="space-y-5">
      {snapshot && (
        <section className="rounded-lg border border-terminal-border bg-terminal-surface/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-terminal-accent">Entradas del cálculo</h4>
            <button type="button" onClick={() => downloadCalculation(snapshot, symbol)} className="rounded border border-terminal-border px-2 py-1 text-[11px] text-terminal-text hover:bg-terminal-surface focus-visible:outline-2 focus-visible:outline-terminal-accent">
              Descargar cálculo JSON
            </button>
          </div>
          <dl className="mt-3 text-[11px]">
            <SnapshotRow label="Liquidación">{formatDate(snapshot.settlementDate)}</SnapshotRow>
            {snapshot.settlementReference && <SnapshotRow label="Referencia de liquidación">{snapshot.settlementReference.date ? 'T+1 hábil · AR-BANK · supuesto' : 'Sin cobertura del calendario'}</SnapshotRow>}
            <SnapshotRow label="Escenario">Hasta vencimiento · sin rescate</SnapshotRow>
            <SnapshotRow label="Convención de descuento">{snapshot.dayCount}</SnapshotRow>
            <SnapshotRow label="Convención de devengamiento">{snapshot.accrualDayCount || 'No registrada'}</SnapshotRow>
            <SnapshotRow label="Rendimiento">Tasa efectiva anual (TEA)</SnapshotRow>
            <SnapshotRow label="Precio recibido">{snapshot.price?.value != null ? `${snapshot.price.value} ${snapshot.price.currency || ''}` : null}</SnapshotRow>
            <SnapshotRow label="Tipo de precio en la fuente">{priceTypeLabel(snapshot.price?.observedPriceType)}</SnapshotRow>
            <SnapshotRow label="Tratamiento del precio">{priceTypeLabel(snapshot.price?.type)}</SnapshotRow>
            <SnapshotRow label="Base nominal en la fuente">{snapshot.price?.nominalBasis === 'original' ? 'Por 100 VN originales' : snapshot.price?.nominalBasis === 'residual' ? 'Por 100 de capital residual' : 'Sin confirmar'}</SnapshotRow>
            <SnapshotRow label="Hora de mercado">{snapshot.price?.marketTimestamp || 'No informada'}</SnapshotRow>
            <SnapshotRow label="Recibido por la aplicación">{snapshot.price?.receivedAt || 'No registrada'}</SnapshotRow>
            <SnapshotRow label="Fuente del precio">{snapshot.price?.source || 'No informada'}</SnapshotRow>
            <SnapshotRow label="Versión contractual">{snapshot.contractVersion || 'Sin versión revisada'}</SnapshotRow>
            <SnapshotRow label="Motor">{snapshot.engineVersion}</SnapshotRow>
          </dl>
          {snapshot.assumptions?.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-terminal-muted">{snapshot.assumptions.map((assumption, index) => <li key={index}>{assumption}</li>)}</ul>}
          <p className="mt-3 text-[11px] leading-relaxed text-terminal-muted">El archivo incluye las entradas y el diagnóstico; agrega resultados cuando el cálculo está habilitado. La hora de recepción no identifica la hora del último negocio.</p>
        </section>
      )}

      {contract && (
        <section className="rounded-lg border border-terminal-accent/25 bg-terminal-accent/5 p-4">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-terminal-accent">Evidencia contractual · versión {contract.version}</h4>
          <p className="mt-2 text-xs leading-relaxed text-terminal-text">Condiciones originales revisadas el {formatDate(contract.reviewDate)}.</p>
          <p className="mt-2 text-[11px] leading-relaxed text-terminal-muted">La revisión cubre los documentos de la emisión original. Las ampliaciones, modificaciones, pagos efectivamente realizados y eventos posteriores requieren revisión adicional. La calificación crediticia se muestra sin verificar.</p>
          <dl className="mt-3 text-[11px]">
            <SnapshotRow label="Instrumento">{contract.instrumentId || contract.id}</SnapshotRow>
            <SnapshotRow label="ISIN Reg S">{contract.isinRegS}</SnapshotRow>
            <SnapshotRow label="ISIN 144A">{contract.isin144A}</SnapshotRow>
            <SnapshotRow label="Moneda contractual">{contract.currency}</SnapshotRow>
            <SnapshotRow label="Base del cupón">{contract.dayCountFamily}</SnapshotRow>
            {contract.paymentConvention && <>
              <SnapshotRow label="Centros de día hábil">Nueva York y Buenos Aires</SnapshotRow>
              <SnapshotRow label="Regla de traslado del pago">Sin verificar</SnapshotRow>
              <SnapshotRow label="Fecha de registro">Un día calendario antes del cupón contractual</SnapshotRow>
              <SnapshotRow label="Variante 30/360">{contract.couponDayCount?.variant || 'No determinada en la evidencia revisada'}</SnapshotRow>
            </>}
          </dl>
          {contract.species?.length > 0 && <p className="mt-3 text-[11px] text-terminal-muted">Especies asociadas: {contract.species.map(species => species.ticker).join(' · ')}. La especie de negociación y sus condiciones de precio se revisan por separado.</p>}
          <div className="mt-4 space-y-3">
            {contract.documents?.map(doc => {
              const evidence = contract.evidence?.filter(item => item.documentId === doc.id) || []
              const pages = [...new Set(evidence.flatMap(item => item.pdfPages || []))].sort((a, b) => a - b)
              return (
                <article key={doc.id || doc.url} className="rounded border border-terminal-border bg-terminal-panel/60 p-3">
                  <h5 className="text-xs font-medium text-terminal-text">{doc.title}</h5>
                  <p className="mt-1 text-[10px] text-terminal-muted">Publicado {formatDate(doc.publishedDate)} · copia del {formatDate(doc.retrievedDate)}{pages.length ? ` · evidencia en páginas PDF ${pages.join(', ')}` : ''}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-terminal-accent underline underline-offset-2">Fuente oficial</a>
                    {doc.localPath && <a href={doc.localPath} download className="text-terminal-accent underline underline-offset-2">Descargar copia PDF</a>}
                  </div>
                  {doc.sha256 && <details className="mt-2 text-[10px] text-terminal-muted"><summary className="cursor-pointer">Huella SHA-256 de la copia</summary><code className="mt-1 block break-all">{doc.sha256}</code></details>}
                  {evidence.length > 0 && <ul className="mt-2 space-y-1 text-[10px] leading-relaxed text-terminal-muted">{evidence.map((item, index) => <li key={index}>{item.fields?.map(field => EVIDENCE_LABELS[field] || field).join(', ')}{item.items?.length ? ` · ítems ${item.items.join(', ')}` : ''}</li>)}</ul>}
                </article>
              )
            })}
          </div>
          {contract.optionalRedemption && <p className="mt-4 text-[11px] leading-relaxed text-terminal-muted">Esta ON admite rescate anticipado, incluido make-whole antes del {formatDate(contract.optionalRedemption.makeWholeBefore)}. La TIR mostrada supone pagos hasta vencimiento. YTC y YTW todavía no están habilitadas.</p>}
        </section>
      )}
    </div>
  )
}
