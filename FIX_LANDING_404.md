# 🔧 FIX: Error 404 en /api/businesses

## 🐛 Problema Identificado

El **landing page** (index.html + landing.js) estaba llamando a:
- `GET /api/businesses` ❌ 
- `GET /api/products/:businessId` ❌
- `POST /api/apartar` ❌

Pero estos endpoints **NO existían** en el servidor porque `landing-api.js` no estaba siendo usado.

## ✅ Solución Implementada

### Cambio en `app.js`

**Agregado:**
```javascript
const landingApi = require('./landing-api');
```

**Y activado las rutas:**
```javascript
// RUTAS DE LANDING API (para el frontend público)
app.use(landingApi);
```

## 📋 Endpoints Ahora Disponibles

### 1. GET /api/businesses
Devuelve lista de negocios activos:
```json
{
  "success": true,
  "businesses": [
    {
      "id": "BIZ-001",
      "nombre": "Mi Negocio",
      "descripcion": "Productos únicos",
      "imagen": "...",
      "telefono": "51999999999",
      "tiktok": "..."
    }
  ]
}
```

### 2. GET /api/products/:businessId
Devuelve productos del negocio:
```json
{
  "success": true,
  "business": {...},
  "products": [
    {
      "id": "PL01",
      "nombre": "Producto",
      "precio": 100,
      "imagen": "...",
      "estado": "disponible"
    }
  ]
}
```

### 3. POST /api/apartar
Crea pedido y devuelve link de WhatsApp:
```json
{
  "success": true,
  "pedidoId": "PL-123456",
  "whatsappUrl": "https://wa.me/51999999999?text=..."
}
```

## 🚀 Despliegue

### Opción 1: Script Automático
```bash
cd "/Users/keylacusi/Desktop/OPEN IA/apartalo-bot"
chmod +x deploy.sh
./deploy.sh
```

### Opción 2: Manual
```bash
cd "/Users/keylacusi/Desktop/OPEN IA/apartalo-bot"
git add .
git commit -m "Fix: Agregar landing-api routes"
git push heroku main
```

## 🧪 Verificación

Después del despliegue, verifica:

1. **Landing page carga:**
   ```
   https://apartalo-63f30bbcbb4a.herokuapp.com/
   ```

2. **API responde:**
   ```
   https://apartalo-63f30bbcbb4a.herokuapp.com/api/businesses
   ```

3. **Logs sin errores:**
   ```bash
   heroku logs --tail
   ```

## 📊 Resultado Esperado

✅ Landing page carga correctamente
✅ Se ven los negocios disponibles
✅ No más error "Error cargando negocios"
✅ Logs sin 404 en `/api/businesses`

---

**Fecha:** 2 de Diciembre 2024
**Versión:** 1.3.1
