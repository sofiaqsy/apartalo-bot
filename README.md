# 🛍️ ApartaLo

Bot multi-negocio para ventas por WhatsApp en lives de TikTok/Instagram.

> *"¡Ya lo aparté!"* - La emoción de comprar en un live

## 🆕 ÚLTIMA VERSIÓN: v1.3.0

**🎉 Novedades:**
- ✅ Pedidos visibles al volver al chat
- ✅ Registro inmediato en Excel al presionar "ApartaLo"
- ✅ Consulta rápida de pedidos por código
- ✅ Mensajes del LIVE optimizados
- ✅ Estados con emojis para mejor UX

📚 **Documentación:**
- [CAMBIOS_IMPLEMENTADOS.md](CAMBIOS_IMPLEMENTADOS.md) - Detalle de mejoras
- [GUIA_ADMIN.md](GUIA_ADMIN.md) - Guía del administrador
- [INSTRUCCIONES_PRUEBA.md](INSTRUCCIONES_PRUEBA.md) - Cómo probar

## 🎯 Problema que resuelve

- **Caos de capturas**: No más "envíame captura del producto"
- **Match manual**: Automatiza el match entre producto mostrado y cliente
- **Reservas concurrentes**: Gestiona cuando varios quieren el mismo producto
- **Liberación de stock**: Control manual post-live para productos no pagados

## 💡 Cómo funciona

### Durante el live:
```
Vendedor: "Esta Monstera es la PL12, S/85, escríbeme PL12 al WhatsApp"

Cliente → WhatsApp: "PL12"

Bot: "🌿 Monstera Variegata
      Precio: S/85
      Disponible: 3 unidades
      
      ¿Cuántas quieres reservar?"

Cliente: "1"

Bot: "✅ ¡Reservada!
      Tu carrito: 1 producto (S/85)
      
      [Seguir comprando] [Pagar] [Ver carrito]"
```

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────┐
│          SPREADSHEET MAESTRO            │
│    (Lista de negocios registrados)      │
└─────────────────┬───────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│Negocio A│ │Negocio B│ │Negocio C│
│ (Excel) │ │ (Excel) │ │ (Excel) │
└─────────┘ └─────────┘ └─────────┘
```

## 📊 Estructura de Google Sheets

### Spreadsheet MAESTRO

**Hoja: Negocios**
| Columna | Nombre | Descripción |
|---------|--------|-------------|
| A | ID | Identificador único (ej: BIZ-001) |
| B | Nombre | Nombre del negocio |
| C | Prefijo | Prefijo para códigos (ej: PL, RP) |
| D | SpreadsheetID | ID del spreadsheet del negocio |
| E | Descripcion | Descripción corta |
| F | Logo_URL | URL del logo (opcional) |
| G | Estado | ACTIVO / INACTIVO |

### Spreadsheet POR NEGOCIO

Cada negocio tiene su propio spreadsheet con estas hojas:

**Hoja: Inventario**
| Columna | Nombre | Descripción |
|---------|--------|-------------|
| A | Codigo | Código del producto (ej: PL01) |
| B | Nombre | Nombre del producto |
| C | Descripcion | Descripción del producto |
| D | Precio | Precio en soles |
| E | Stock | Stock total disponible |
| F | StockReservado | Unidades actualmente reservadas |
| G | ImagenURL | URL de imagen (opcional) |
| H | Estado | ACTIVO / INACTIVO |

**Hoja: Pedidos**
| Columna | Nombre | Descripción |
|---------|--------|-------------|
| A | ID | Código de pedido (ej: PL-123456) |
| B | Fecha | Fecha del pedido |
| C | Hora | Hora del pedido |
| D | WhatsApp | Número de WhatsApp del cliente |
| E | Cliente | Nombre del cliente |
| F | Telefono | Teléfono de contacto |
| G | Direccion | Dirección de entrega |
| H | Productos | Productos (formato: codigo:nombre:cant:precio) |
| I | Total | Total del pedido |
| J | Estado | Estado del pedido |
| K | VoucherURL | URL del comprobante |
| L | Observaciones | Notas adicionales |

**Estados de pedido:**
- `PENDIENTE_PAGO` - Esperando pago
- `PENDIENTE_VALIDACION` - Voucher enviado, por validar
- `CONFIRMADO` - Pago validado
- `EN_PREPARACION` - Preparando envío
- `ENVIADO` - En camino
- `ENTREGADO` - Completado
- `CANCELADO` - Cancelado

**Hoja: Clientes**
| Columna | Nombre | Descripción |
|---------|--------|-------------|
| A | ID | ID del cliente |
| B | WhatsApp | Número de WhatsApp |
| C | Nombre | Nombre completo |
| D | Telefono | Teléfono de contacto |
| E | Direccion | Dirección de entrega |
| F | FechaRegistro | Fecha de primer pedido |
| G | UltimaCompra | Fecha de última compra |

## 🚀 Instalación

### 1. Clonar y configurar

```bash
git clone https://github.com/sofiaqsy/apartalo-bot.git
cd apartalo-bot
npm install
cp .env.example .env
```

### 2. Configurar WhatsApp Cloud API

1. Ir a [Meta for Developers](https://developers.facebook.com)
2. Crear una app de negocio
3. Agregar el producto "WhatsApp"
4. Obtener el token y phone ID
5. Copiar valores a `.env`

### 3. Configurar Google Sheets

1. Ir a [Google Cloud Console](https://console.cloud.google.com)
2. Crear un proyecto
3. Habilitar Google Sheets API
4. Crear una Service Account
5. Descargar las credenciales JSON
6. Copiar el JSON (una línea) a `GOOGLE_SERVICE_ACCOUNT_KEY`
7. Crear el spreadsheet MAESTRO y copiar el ID a `MASTER_SPREADSHEET_ID`

### 4. Crear estructura de hojas

En el spreadsheet MAESTRO:
- Crear hoja "Negocios" con los headers indicados

Para cada negocio:
- Crear un nuevo spreadsheet
- Crear hojas: Inventario, Pedidos, Clientes
- Compartir con el email de la Service Account
- Agregar el negocio a la hoja "Negocios" del MAESTRO

### 5. Iniciar

```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## 🔧 Variables de entorno

```env
# WhatsApp
WHATSAPP_TOKEN=tu_token
WHATSAPP_PHONE_ID=tu_phone_id
WHATSAPP_VERIFY_TOKEN=LIVE_COMMERCE_2024

# Google Sheets
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
MASTER_SPREADSHEET_ID=tu_spreadsheet_id

# Plataforma
PLATFORM_NAME=ApartaLo
PORT=3000
NODE_ENV=development
```

## 📱 Flujo del cliente

### Flujo LIVE Commerce (Nuevo en v1.3)

```
1. Cliente escribe "Hola"
   ↓
2. Bot muestra pedidos activos (si tiene)
   ↓
3. Bot ofrece suscribirse al LIVE
   ↓
4. Cliente elige "LIVE 5 min" o "LIVE 10 min"
   ↓
5. Vendedor hace broadcast de producto
   ↓
6. Cliente recibe producto con botón "ApartaLo"
   ↓
7. Cliente presiona "ApartaLo" (el primero gana)
   ↓
8. ✅ Pedido creado INMEDIATAMENTE en Excel
   ↓
9. Cliente recibe código de pedido (ej: PL-123456)
   ↓
10. Cliente envía voucher de pago
    ↓
11. Pedido cambia a "PENDIENTE_VALIDACION"
    ↓
12. Admin valida y confirma pedido
```

### Consulta de Pedidos (Nuevo en v1.3)

```
Cliente escribe el código del pedido (ej: PL-123456)
   ↓
Bot muestra detalle completo:
- Estado actual
- Productos
- Total
- Dirección de entrega
- Acción siguiente
```

## 🆕 Novedades v1.3

- ✅ **Pedidos visibles al volver**: Al escribir "hola", ves tus pedidos activos
- ✅ **Registro inmediato**: Pedido se crea al presionar "ApartaLo"
- ✅ **Consulta rápida**: Escribe el código del pedido para ver detalles
- ✅ **Mensajes optimizados**: Información del LIVE más clara y directa
- ✅ **Estados con emojis**: Fácil de entender el estado de tu pedido

## 🔑 Comandos del cliente

| Comando | Acción |
|---------|--------|
| `inicio` / `home` | Volver al inicio |
| `negocios` / `cambiar` | Ver lista de negocios |
| `carrito` | Ver carrito actual |
| `pagar` | Iniciar proceso de pago |
| `cancelar` | Cancelar y limpiar carrito |
| `[código]` | Buscar y reservar producto |

## 📊 Estados de Pedidos

| Estado | Emoji | Descripción |
|--------|-------|-------------|
| PENDIENTE_PAGO | ⏳ | Producto apartado, esperando pago |
| PENDIENTE_VALIDACION | 🔍 | Voucher enviado, en validación |
| CONFIRMADO | ✅ | Pago confirmado |
| EN_PREPARACION | 📦 | Preparando el envío |
| ENVIADO | 🚚 | Pedido en camino |
| ENTREGADO | ✅ | Pedido completado |
| CANCELADO | ❌ | Pedido cancelado, stock liberado |

## 💰 Modelo de negocio

**Sugerencia de pricing:**
- S/15/mes por negocio
- Incluye: bot, gestión en Sheets, soporte básico

**Proyección:**
| Negocios | Ingreso mensual |
|----------|-----------------|
| 10 | S/150 |
| 30 | S/450 |
| 50 | S/750 |

## 🛠️ Próximos pasos

- [ ] Panel web para que cada negocio vea sus pedidos
- [ ] Notificaciones a vendedores (Telegram)
- [ ] Reportes automáticos de ventas
- [ ] Integración con pasarelas de pago
- [ ] Bot de Telegram para administración

## 📄 Licencia

MIT
