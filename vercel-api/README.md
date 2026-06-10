# API Vercel + Neon para App Inventario

Esta API guarda el estado completo de la app en Neon usando una tabla `app_state`.

## Variables en Vercel

Configura estas variables en el proyecto de Vercel:

```text
DATABASE_URL=postgresql://...
ALLOWED_ORIGIN=https://cristian-60302.github.io
```

`DATABASE_URL` sale del panel de Neon. Para este proyecto, usa en Vercel la connection string de Neon como `DATABASE_URL`, sin pegarla en ningun archivo del frontend. `ALLOWED_ORIGIN` debe ser la URL base de GitHub Pages. Para pruebas puedes usar `*`.

## Despliegue

```bash
npm install
npm run deploy
```

Cuando Vercel entregue la URL, copia esa URL en:

```text
js/config.js
```

Ejemplo:

```js
window.APP_CONFIG = {
  API_BASE_URL: "https://tu-api-de-vercel.vercel.app",
}
```

## Endpoints

```text
GET /api/state
PUT /api/state
POST /api/state
```

El cuerpo para guardar es:

```json
{
  "data": {
    "products": [],
    "clients": [],
    "sales": [],
    "creditSales": [],
    "quotations": [],
    "catalogs": {}
  }
}
```
