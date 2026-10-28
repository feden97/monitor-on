# Inventario de fuentes y referencias

Consulta: **27 de octubre de 2026**, horario de Argentina. Investigación pública; no se utilizaron cuentas ni credenciales de proveedores. Los valores observados son una captura de investigación, no una cotización operativa.

## Qué pudo verificarse

| Fuente | Acceso y datos verificados | Uso propuesto y límite observado |
| --- | --- | --- |
| [Docta Terminal](https://app.docta.com.ar/dashboard) | Vista pública de mercado; el dashboard muestra plazo 24 hs y descarga de próximos pagos. La información de cartera requiere sesión. | Referencia funcional y comparación mediante API, cuando haya credenciales. No se capturó una ficha numérica de YM34D. |
| [Docta: onboarding oficial](https://docs.docta.com.ar/onboarding-ia) | API de instrumentos, rendimientos, flujos y calculadora. La documentación dice expresamente que bonos no incluye precios de mercado, OHLC ni volumen. Rendimientos con aproximadamente 20 minutos de demora. Tasas en decimales. | Conector del servidor: OAuth de cliente y secreto fuera del frontend. No reemplaza la fuente de cotizaciones. |
| [Docta: MCP oficial](https://docs.docta.com.ar/servidor-mcp) | Servidor `https://mcp.docta.com.ar/mcp`, OAuth y herramientas de búsqueda, cashflows, residual, rendimientos y cálculo. Hay cuotas por plan. | Alternativa de investigación asistida; no se configuró ni utilizó este MCP en la sesión. |
| [Club de Bonos-FCI](https://club-de-bonosfci.netlify.app/) | Inspección en navegador: el pie identifica fuentes y advierte que no verifica independientemente los datos. El contenido principal permaneció cargando el Google Sheet. | Referencia del universo y procedencia. No se descargaron planillas ni se obtuvo una cotización comparable. |
| [BondTerminal: API](https://bondterminal.com/developers) | Publica una API REST con autenticación por clave, cálculo individual y por lotes, límites y especificación OpenAPI. | Comparación con licencia adecuada. No se consumió la API ni se generaron claves. |
| [Monitor ON publicado](https://monitor-on.vercel.app/) | El navegador cargó la tabla y sus métricas. El pie declara data912, CriptoYa y ArgentinaDatos. | Base real a evolucionar; investigar cada fila contra su documento y conservar contexto de cálculo. |

### Fuentes declaradas por Club

El pie público asigna precios a data912, con BYMA como respaldo; historia a IOL/Rava; MEP a dolarapi; riesgo país a ArgentinaDatos; A3500 al BCRA; montos, residual e ISIN a BYMA; y documentos de emisión, resoluciones y avisos de pago al MAE. Los datos de instrumentos y flujos provienen de planillas del Club. También indica un selector de precio vivo o planilla. Esto documenta su declaración de procedencia, no una validación de esos conectores o sus permisos de reutilización.

## Convenciones que impiden comparar directamente dos TIR

La [metodología de BondTerminal](https://bondterminal.com/methodology/yields) publica para bonos en dólares rendimiento nominal anual con capitalización semestral y muestra también su equivalente efectivo anual. Su conversión es `j2 = 2 × (sqrt(1 + TEA) − 1)`: 9,24% efectivo equivale aproximadamente a 9,04% nominal semestral. Declara tiempos de descuento ACT/365; esto debe distinguirse de la base contractual del cupón.

Para instrumentos rescatables, su métrica principal puede ser YTW y su duration seguir ese rescate. La metodología incluye reglas propias para rescates cercanos. Son decisiones del proveedor que deben identificarse al auditarlo, no adoptarse como definición universal.

Antes de comparar: instrumento/ISIN y especie; moneda y plaza; fecha/hora de precio; liquidación y calendario; precio limpio o sucio; base por VN original o residual; cronograma y redondeo; devengamiento; convención de rendimiento; escenario de vencimiento o rescate; y definición de duration. La coincidencia entre proveedores no demuestra corrección si comparten una fuente.

## Primera evidencia contractual: YPF Clase XXXIV, 2034

| Documento primario | Evidencia útil |
| --- | --- |
| [Aviso de resultados](https://inversores.ypf.com/documents/emisiones/internacionales/YPF-Aviso-de-Resultados-ON-Clase-XXXIV.pdf) | Página PDF 1: emisión 17/01/2025, vencimiento 17/01/2034, cupón 8,25%, fechas semestrales y amortización 30/30/40 en enero 2032/2033/2034. Páginas 1–2: rescates; página 2: ambos ISIN. |
| [Aviso de suscripción](https://inversores.ypf.com/documents/emisiones/internacionales/YPF-Aviso-de-Suscripcion-ON-XXXIV-Internacional.pdf) | Ítem 18: intereses sobre año de 360 días, doce meses de 30 días. La cláusula de make-whole del aviso de resultados, por sí sola, no prueba la base del cupón. |
| [Suplemento de prospecto internacional](https://inversores.ypf.com/documents/emisiones/internacionales/YPF-Suplemento-ON-XXXIV-Internacional.pdf) | Condiciones completas de la oferta del 02/01/2025; interpretar junto con resultados y modificaciones. |
| [Emisiones de YPF](https://inversores.ypf.com/Emisiones.html) | Índice de documentos originales y de ampliaciones. Permite distinguir monto originalmente emitido de monto vigente. |

Reg S: `USP989MJBY67`; 144A: `US984245BB55`. El primer cupón del 17/07/2025 corresponde a un semestre regular desde emisión. Intereses calculados sobre capital pendiente: tras amortizar 30, el siguiente cupón por VN original 100 baja de 4,125 a 2,8875; tras otra cuota de 30, baja a 1,65.

Hay rescate make-whole antes de enero 2029 y escalones posteriores de precio. Calcular solamente los escalones de call no representa toda la opcionalidad. Las fechas contractuales también deben separarse de las fechas ajustadas de pago. Existe otro documento de YPF llamado Clase XXXIV en la sección local: el nombre de clase sin ISIN y fecha de emisión es insuficiente.

## Observación de pantalla: diferencias todavía no adjudicables

| Campo | Monitor ON | BondTerminal, ficha pública interactiva |
| --- | --- | --- |
| Especie mostrada | YM34D | YM34C, selector C activo |
| Precio | USD 109,05; naturaleza a confirmar en código/fuente | Limpio 102,59; sucio 104,90; corrido 2,3146 |
| Rendimiento | TIR efectiva anual 7,03% | YTW 7,51% nominal semestral; 7,65% efectivo |
| Escenario | A confirmar contra implementación | Rescate 17/01/2031 |
| Liquidación | A confirmar contra implementación | 28/10/2026 |
| Duration mostrada | 4,98 | 3,45 |
| Próximo cupón | 18/01/2027 | 17/01/2027 |

BondTerminal mostraba hora de precio **16:56 ART**. Su texto público estático también conservaba el cierre del 26/10: 100,41 y YTW 8,12%; no confundir ese texto con el panel actualizado. Monitor mostraba actualización 17:11:46. Esta observación no contiene precios sincronizados ni todas las convenciones: **no permite concluir que una de las dos TIR sea errónea**. La diferencia de próximo pago requiere revisar calendario y fecha contractual, y la de duration puede incluir el escenario de rescate.

Monitor también ubicaba rendimientos de SNSDD y LMS8D superiores a 300% en “Mejor TIR”. Eso justifica verificar cronogramas, estado crediticio, precio y liquidez antes de utilizarlos en un ranking; no prueba por sí mismo un error matemático.

## Acceso documental y reutilización

Los [términos de BondTerminal](https://bondterminal.com/terms), actualizados el 16/10/2026, restringen scraping/crawling/descarga masiva fuera de la API y redistribución como feed o producto competidor. Las claves Basic tampoco habilitan publicar datos. Usar su interfaz como referencia y evaluar casos individuales con atribución; una integración pública necesita condiciones compatibles. Los enlaces documentales visibles no garantizan acceso anónimo: la consulta automática de tres enlaces de su ficha fue rechazada. Los documentos equivalentes se localizaron directamente en YPF.

Para el recolector: descargar documentos oficiales por emisor, registrar URL, instante, SHA-256 y páginas de evidencia, conservar versiones y distinguir extracción propuesta de condición revisada. El libro local es material privado de validación: no incorporarlo al frontend público.

## Referencia de diseño observada

La ficha de BondTerminal usa tipografía monoespaciada, jerarquía clara de precio/rendimiento/spread, fecha de liquidación visible, precio limpio/sucio/corrido juntos, escenarios de ±100 pb, métricas agrupadas, documentos y pestañas de pagos/rescates. Conviene adoptar esa claridad del flujo de trabajo y sumar procedencia y estado de revisión a cada resultado. No hace falta cambiar de framework para producir esa experiencia.

## Pendiente para la comparación completa

No se completó una auditoría numérica sincronizada de las tres plataformas. Falta obtener un precio común con especie y liquidación explícitas; capturar los flujos de cada proveedor; documentar sus convenciones; reproducir cada resultado y clasificar la diferencia como explicada, error demostrado o información insuficiente. Club no entregó su tabla durante esta consulta y Docta requiere conexión autenticada para ampliar el caso. Eso limita el diagnóstico, no impide validar el motor propio con documentos y casos del libro.
