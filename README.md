# 📊 ONs Dashboard — Obligaciones Negociables · Mercado Argentino

Panel Bloomberg-style para visualizar datos en tiempo real de Obligaciones Negociables (ONs) del mercado argentino.

## Stack

| Herramienta | Versión | Rol |
|---|---|---|
| React | 18 | UI framework |
| Vite | 5 | Build tool / dev server |
| TanStack Table | 8 | Tabla de datos con sorting/filtering |
| Tailwind CSS | 3 | Estilos utilitarios |
| Lucide React | latest | Íconos |

## Inicio rápido

```bash
# 1. Clonar / descomprimir el proyecto
cd arg-ons-dashboard

# 2. Instalar dependencias
npm install

# 3. Levantar el servidor de desarrollo
npm run dev
```

Abrí [http://localhost:5173](http://localhost:5173) en tu navegador.

## Proxy CORS

Durante el desarrollo local, Vite actúa como proxy para evitar errores CORS del navegador:

```
Browser → /api/live/arg_corp  →  Vite proxy  →  https://data912.com/live/arg_corp
```

Esto está configurado en `vite.config.js`. **No es necesario ningún cambio adicional** para el entorno de desarrollo.

En producción (deploy en servidor), configurá tu servidor (nginx, Caddy, etc.) con un proxy reverso al mismo endpoint, o utilizá un backend propio.

## Estructura del proyecto

```
arg-ons-dashboard/
├── public/
├── src/
│   ├── components/
│   │   ├── BondsTable.jsx    # Tabla principal (TanStack Table)
│   │   ├── StatsBar.jsx      # Resumen estadístico
│   │   └── ErrorBanner.jsx   # Banner de error con retry
│   ├── hooks/
│   │   └── useBondsData.js   # Fetch + auto-refresh cada 30s
│   ├── utils/
│   │   └── formatters.js     # Formateo de precios, %%, números
│   ├── App.jsx               # Componente raíz
│   ├── main.jsx
│   └── index.css             # Tailwind + estilos globales
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js            # Configuración Vite + proxy
└── package.json
```

## Próximos pasos sugeridos

- [ ] Agregar cálculo de TIR (backend / worker)
- [ ] Agregar columna de Paridad
- [ ] Filtros por tipo de moneda (ARS / USD)
- [ ] Exportación a CSV / Excel
- [ ] Modo oscuro
- [ ] Gráfico de velas intradiario por instrumento

## Datos

Los datos provienen de [data912.com](https://data912.com) y se actualizan automáticamente cada **30 segundos**.

> ⚠️ Los datos tienen carácter informativo y no constituyen asesoramiento financiero.
