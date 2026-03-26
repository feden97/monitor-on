# Visión y Roadmap V2: "Paridad.ar"

Este documento recolecta las ideas de diseño, métricas y experiencia de usuario (UX/UI) para la futura versión avanzada del Monitor de Obligaciones Negociables.

## El Concepto Central
Transformar el monitor de una "lista de precios" a una **herramienta de análisis financiero y detección de oportunidades/desarbitrajes** en el mercado de renta fija argentina.
El nombre tentativo para esta evolución es **Paridad.ar** (o variantes como TIR.ar, Spread.ar).

La métrica estrella del sitio será la **Paridad**, fundamental en el mercado argentino para identificar bonos sobrecomprados por el cepo (ej. paridades del 110% con TIR negativa) o bonos castigados que representan oportunidades.

---

## Estructura de la Pantalla Principal (Dashboard V2)

La pantalla principal debe estructurarse en tres grandes bloques visuales, yendo de lo general a lo específico, sin abrumar con datos en el primer segundo:

### 1. El "Hero Bar" (Métricas Globales)
Un panel superior que resuma cómo "respira" el mercado hoy:
- **Paridad Promedio Mercado:** Ej. `97.5%`. Indica si el mercado está barato o caro en general.
- **TIR Promedio (Ley NY vs Ley Arg):** Promedios de rendimiento dolarizado para saber qué jurisdicción rinde más.
- **🔥 Top Oportunidad del Día:** El instrumento con el mejor ratio TIR/Paridad (ej. TIR > 9% comprando bajo la par).
- **⚠️ Alerta de Sobreprecio:** El ticker más peligroso (ej. rindiendo TIR negativa o con paridad > 105%).

### 2. Filtros Rápidos "1-Click" (Pastillas/Pills)
Botones interactivos arriba de la tabla para filtrar sin tener que ordenar manualmente:
- `[ Mostrar Bajo la Par (<100%) ]`
- `[ Ver Ley Nueva York (Hard Dollar) ]`
- `[ Vencimiento Corto (< 2026) ]`
- `[ Alta Liquidez (Volumen > $10M) ]`

### 3. La Tabla Central (Densidad Inteligente)
La tabla es el core, pero las columnas deben tener una jerarquía estricta.
**Columnas Primarias (Siempre Visibles):**
1. Ticker & Empresa (Fijado a la izquierda)
2. Precio (ARS o USD)
3. Variación % (Feedback visual de mercado en tiempo real)
4. **Paridad %** (Destacada: >100% rojo/naranja prudente, <100% verde)
5. **TIR (Yield)** (Rendimiento anualizado proyectado)
6. Cupón Corriente (Flujo de caja actual)

**Columnas Secundarias (Expandibles o Opcionales):**
- Volumen (sin decimales) y Operaciones
- Vencimiento (Fecha exacta)
- Modified Duration (Riesgo de tasa)
- Valor Residual / Lámina mínima

---

## 🚀 El "Santo Grial" (Features Avanzadas)

### El Gráfico de Dispersión (Scatter Plot): TIR vs Paridad
Un gráfico interactivo donde cada punto es una ON. 
- Eje X: Paridad (%)
- Eje Y: TIR (%)
**Objetivo:** Los puntos que queden en el cuadrante "Arriba a la Izquierda" (TIR alta, Paridad baja) son de forma visual e instintiva las mejores oportunidades del mercado. Los del extremo inferior derecho son las "trampas".

### Estética
Mantener la vibra **Terminal Pro / DeFi**:
- Modo Oscuro Profundo (Fondos `#0F0F13`) con acentos Neon Cyan (`#22D3EE`) y grises sutiles.
- Modo Claro Corporativo (Slate `#1E293B`) para contraste óptimo y descanso visual.
- Tipografía Monoespaciada (ej. IBM Plex Mono) para todos los números, garantizando legibilidad financiera extrema. Transiciones instantáneas.
