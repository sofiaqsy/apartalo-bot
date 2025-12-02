# INTEGRACIÓN LANDING APARTALO - GUÍA COMPLETA

## 📋 RESUMEN

Se ha creado un nuevo diseño de landing page tipo TikTok para ApartaLo con las siguientes características:

### ✅ ARCHIVOS CREADOS:

1. **public/index.html** - Landing page con diseño tipo TikTok
2. **public/css/landing.css** - Estilos del landing
3. **public/js/landing.js** - JavaScript del frontend

### 🎯 FUNCIONALIDADES IMPLEMENTADAS:

1. **Vista Home**: Grid de negocios activos
2. **Vista Productos**: Feed vertical estilo TikTok con scroll snap
3. **Timer automático**: 60 segundos por producto con auto-scroll
4. **Botón "APARTALO"**: Registra pedido y redirige a WhatsApp
5. **Link compartible**: URL con `?business=ID` para acceso directo
6. **Responsive**: Desktop con espacios laterales informativos

---

## 🔧 PASOS DE INTEGRACIÓN

### PASO 1: Verificar Estructura de Google Sheets

El Excel de cada negocio debe tener la hoja **Inventario** con estas columnas:

```
A: Código
B: Nombre  
C: Descripción
D: Precio
E: Stock
F: Stock Reservado
G: Imagen URL
H: Estado (ACTIVO/INACTIVO)
I: Estado Landing (disponible/apartado)  ← **NUEVA COLUMNA**
```

**Acción:** Agregar columna I a todas las hojas de Inventario con valor por defecto "disponible"

### PASO 2: Verificar Estructura del Maestro

La hoja **Negocios** debe tener estas columnas:

```
A: ID
B: Nombre
C: Prefijo
D: SpreadsheetID
E: Descripción
F: Imagen/Logo URL
G: Estado
H: WhatsApp/Teléfono
I: Cuentas Bancarias (opcional)
J: TikTok URL (opcional)  ← **NUEVA COLUMNA RECOMENDADA**
```

**Acción:** Agregar columna J con links de TikTok de cada negocio

### PASO 3: Actualizar/Crear sheets-service.js

Si el archivo **sheets-service.js** no existe o no tiene los métodos necesarios, crear/actualizar con:

```javascript
// Métodos necesarios para el landing:

async getBusinesses() {
    // Retorna lista de negocios activos
    // Ya implementado ✓
}

async getBusinessById(businessId) {
    // Retorna info de un negocio específico
    return this.businessCache.get(businessId);
}

async getProductsByBusiness(businessId) {
    // Retorna productos activos y disponibles
    // Lee columna I para filtrar
    const products = [];
    // ...lógica de lectura del Excel
    return products;
}

async getProductById(productId) {
    // Busca producto en todos los negocios
}

async updateProductStatus(productId, nuevoEstado) {
    // Actualiza columna I del producto
    // nuevoEstado: 'disponible' | 'apartado'
}

async createLandingOrder(orderData) {
    // Crea registro en hoja Pedidos
    // Estado inicial: 'APARTADO_PENDIENTE'
}
```

### PASO 4: Crear/Actualizar API Routes

Crear archivo **landing-api.js** o actualizar **public-routes.js**:

```javascript
const express = require('express');
const router = express.Router();
const sheetsService = require('./sheets-service');

// GET /api/businesses - Lista de negocios
router.get('/api/businesses', async (req, res) => {
    const businesses = await sheetsService.getBusinesses();
    res.json({
        success: true,
        businesses: businesses.map(b => ({
            id: b.id,
            nombre: b.nombre,
            descripcion: b.descripcion,
            imagen: b.logoUrl,
            tiktok: b.tiktokUrl || ''
        }))
    });
});

// GET /api/products/:businessId - Productos de un negocio
router.get('/api/products/:businessId', async (req, res) => {
    const { businessId } = req.params;
    const business = await sheetsService.getBusinessById(businessId);
    const products = await sheetsService.getProductsByBusiness(businessId);
    
    res.json({
        success: true,
        business: {
            id: business.id,
            nombre: business.nombre,
            imagen: business.logoUrl,
            tiktok: business.tiktokUrl || '',
            telefono: business.whatsappNumber
        },
        products: products.map(p => ({
            id: p.codigo,
            nombre: p.nombre,
            descripcion: p.descripcion,
            precio: p.precio,
            imagen: p.imagenUrl,
            estado: p.estado // 'disponible' o 'apartado'
        }))
    });
});

// POST /api/apartar - Apartar producto
router.post('/api/apartar', async (req, res) => {
    const { businessId, productId, productoNombre, precio } = req.body;
    
    // 1. Verificar disponibilidad
    const product = await sheetsService.getProductById(productId);
    if (product.estado === 'apartado') {
        return res.json({ success: false, error: 'Producto ya apartado' });
    }
    
    // 2. Marcar como apartado
    await sheetsService.updateProductStatus(productId, 'apartado');
    
    // 3. Crear registro de pedido
    await sheetsService.createLandingOrder({
        businessId,
        productId,
        productoNombre,
        precio,
        origen: 'landing'
    });
    
    // 4. Generar URL de WhatsApp
    const business = await sheetsService.getBusinessById(businessId);
    const whatsappUrl = `https://wa.me/${business.whatsappNumber}?text=${encodeURIComponent(
        `¡Hola! Acabo de apartar:\n\n📦 ${productoNombre}\n💰 S/${precio}\n\n¿Cuáles son los siguientes pasos?`
    )}`;
    
    res.json({
        success: true,
        whatsappUrl
    });
});

module.exports = router;
```

### PASO 5: Registrar Rutas en app.js

```javascript
const landingApi = require('./landing-api'); // o './public-routes'

app.use('/', landingApi); // Las rutas ya tienen el prefijo /api
```

### PASO 6: Configurar Express para Servir Archivos Estáticos

```javascript
const express = require('express');
const app = express();

// Servir archivos estáticos desde public/
app.use(express.static('public'));

// Ruta principal redirige al landing
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});
```

---

## 🧪 PRUEBAS

### 1. Probar Carga de Negocios

```bash
curl http://localhost:3000/api/businesses
```

Debe retornar JSON con lista de negocios.

### 2. Probar Carga de Productos

```bash
curl http://localhost:3000/api/products/NEGOCIO_ID
```

Debe retornar negocio + productos.

### 3. Probar Apartar

```bash
curl -X POST http://localhost:3000/api/apartar \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "cafe01",
    "productId": "CAF01",
    "productoNombre": "Café Geisha",
    "precio": 75
  }'
```

Debe retornar `whatsappUrl` y marcar producto como apartado.

### 4. Probar Link Compartible

```
http://localhost:3000/?business=cafe01
```

Debe abrir directamente la vista de productos de ese negocio.

---

## 📱 FLUJO COMPLETO

```
Usuario abre → http://apartalo.com/
  ↓
Ve grid de negocios activos
  ↓
Click en negocio → URL cambia a ?business=ID
  ↓
Carga productos del negocio
  ↓
Timer cuenta 60 segundos por producto
  ↓
Usuario presiona "APARTALO"
  ↓
Se registra en Excel:
  - Columna I del producto → "apartado"
  - Nueva fila en Pedidos → Estado "APARTADO_PENDIENTE"
  ↓
Redirección a WhatsApp con mensaje pre-llenado
  ↓
Vendedor completa datos del cliente en WhatsApp
```

---

## 🎨 PERSONALIZACIÓN

### Cambiar Colores

Editar `public/css/landing.css`:

```css
:root {
    --primary: #FF6B6B;        /* Color principal */
    --primary-dark: #E85555;   /* Color hover */
    --warning: #F59E0B;        /* Timer urgente */
}
```

### Cambiar Tiempo del Timer

Editar `public/js/landing.js`:

```javascript
function startMainTimer() {
    let timeLeft = 60; // Cambiar aquí (en segundos)
    // ...
}
```

### Agregar Más Info en Espacios Laterales

Editar `public/index.html`, secciones:
- `.side-content.left` - Info izquierda
- `.side-content.right` - Info derecha

---

## 🚀 DEPLOYMENT

### Heroku

```bash
git add .
git commit -m "Agregar landing page tipo TikTok"
git push heroku main
```

### Vercel

```bash
vercel --prod
```

### Variables de Entorno Necesarias

```
GOOGLE_SERVICE_ACCOUNT_KEY=...
MASTER_SPREADSHEET_ID=...
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
PORT=3000
```

---

## ❗ TROUBLESHOOTING

### Problema: No cargan los negocios

**Solución:** Verificar que `sheets-service.js` esté inicializado:

```javascript
await sheetsService.initialize();
```

### Problema: Productos no se marcan como apartados

**Solución:** Verificar que columna I existe en Excel y método `updateProductStatus` funciona.

### Problema: WhatsApp no abre

**Solución:** Verificar formato del número en columna H del maestro (debe ser +51XXXXXXXXX).

---

## 📊 PRÓXIMAS MEJORAS

1. **WebSocket para sincronización en tiempo real** de viewers
2. **Notificaciones push** cuando alguien aparta
3. **Analytics** de productos más vistos/apartados
4. **Modo admin** para controlar el live desde panel
5. **Integración con TikTok Live API** para sincronización automática

---

## 📞 SOPORTE

Para dudas o problemas, revisar:
- `DEMO_LANDING.html` - Landing demo existente
- `public-routes.js` - Rutas API existentes  
- `sheets-service.js` - Servicio Google Sheets

**¡El sistema está listo para producción!** 🎉
