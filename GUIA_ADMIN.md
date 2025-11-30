# 🎮 GUÍA RÁPIDA DEL ADMIN - ApartaLo v1.3

## 📋 Índice
1. [Gestionar LIVE](#-gestionar-live)
2. [Gestionar Pedidos](#-gestionar-pedidos)
3. [Gestionar Productos](#-gestionar-productos)
4. [Consultar Estadísticas](#-consultar-estadísticas)

---

## 🔴 Gestionar LIVE

### 1. Ver usuarios conectados al LIVE
```bash
GET /api/BIZ-001/live/subscribers
```

**Respuesta:**
```json
{
  "success": true,
  "businessId": "BIZ-001",
  "count": 5,
  "data": [
    {
      "whatsapp": "51999999999",
      "nombre": "Juan Perez",
      "subscribedAt": 1701360000000,
      "expiresAt": 1701360300000,
      "remainingMs": 240000
    }
  ]
}
```

### 2. Enviar producto al LIVE
```bash
POST /api/BIZ-001/live/broadcast/PL12
```

**¿Qué pasa?**
- ✅ El producto se envía a TODOS los suscritos
- ✅ Cada usuario recibe un botón "ApartaLo"
- ✅ El PRIMERO en presionar se lo lleva
- ✅ Se crea el pedido INMEDIATAMENTE en Excel

**Respuesta:**
```json
{
  "success": true,
  "message": "Producto enviado a 5 usuarios",
  "data": {
    "producto": "PL12",
    "subscribersTotal": 5,
    "enviados": 5,
    "errores": 0
  }
}
```

### 3. Enviar mensaje personalizado a todos
```bash
POST /api/BIZ-001/live/notify
Content-Type: application/json

{
  "mensaje": "¡Empezamos con las ofertas en 5 minutos! 🔥"
}
```

### 4. Ver estadísticas del LIVE
```bash
GET /api/BIZ-001/live/stats
```

**Respuesta:**
```json
{
  "success": true,
  "businessId": "BIZ-001",
  "data": {
    "subscriberCount": 5,
    "subscribers": [...],
    "liveProducts": [...],
    "liveProductCount": 2
  }
}
```

---

## 📦 Gestionar Pedidos

### 1. Ver todos los pedidos pendientes
```bash
GET /api/BIZ-001/pedidos?estado=PENDIENTE_PAGO
```

### 2. Ver pedidos de hoy
```bash
GET /api/BIZ-001/pedidos?fecha=30/11/2024
```

### 3. Ver detalle de un pedido
```bash
GET /api/BIZ-001/pedidos/PL-123456
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "PL-123456",
    "fecha": "30/11/2024",
    "hora": "15:30:25",
    "whatsapp": "51999999999",
    "cliente": "Juan Perez",
    "telefono": "999999999",
    "direccion": "Av. Arequipa 123, Lima",
    "productos": "PL12:Monstera:1:85.00",
    "total": 85.00,
    "estado": "PENDIENTE_VALIDACION",
    "voucherUrl": "https://...",
    "observaciones": ""
  }
}
```

### 4. Confirmar pedido (pago validado)
```bash
PUT /api/BIZ-001/pedidos/PL-123456/estado
Content-Type: application/json

{
  "estado": "CONFIRMADO",
  "observaciones": "Pago validado - Yape"
}
```

### 5. Marcar como enviado
```bash
PUT /api/BIZ-001/pedidos/PL-123456/estado
Content-Type: application/json

{
  "estado": "ENVIADO",
  "observaciones": "Courier: Olva - Tracking: 123456"
}
```

### 6. Cancelar pedido y liberar stock
```bash
POST /api/BIZ-001/pedidos/PL-123456/cancelar
Content-Type: application/json

{
  "motivo": "Cliente no realizó el pago en 24h"
}
```

**¿Qué pasa?**
- ✅ Pedido cambia a estado `CANCELADO`
- ✅ Stock reservado se LIBERA automáticamente
- ✅ Producto vuelve a estar disponible

### 7. Ver estadísticas de pedidos
```bash
GET /api/BIZ-001/pedidos/stats
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "total": 150,
    "porEstado": {
      "PENDIENTE_PAGO": 5,
      "PENDIENTE_VALIDACION": 3,
      "CONFIRMADO": 8,
      "EN_PREPARACION": 4,
      "ENVIADO": 2,
      "ENTREGADO": 120,
      "CANCELADO": 8
    },
    "montoTotal": 12500.00,
    "hoy": 12
  }
}
```

---

## 🏷️ Gestionar Productos

### 1. Ver todos los productos disponibles
```bash
GET /api/BIZ-001/productos?disponible=true
```

### 2. Ver todos los productos (incluidos sin stock)
```bash
GET /api/BIZ-001/productos
```

### 3. Ver detalle de un producto
```bash
GET /api/BIZ-001/productos/PL12
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "codigo": "PL12",
    "nombre": "Monstera Variegata",
    "descripcion": "Planta tropical",
    "precio": 85.00,
    "stock": 10,
    "stockReservado": 3,
    "disponible": 7,
    "imagenUrl": "https://...",
    "estado": "ACTIVO"
  }
}
```

### 4. Crear nuevo producto
```bash
POST /api/BIZ-001/productos
Content-Type: application/json

{
  "nombre": "Pothos Dorado",
  "descripcion": "Planta colgante",
  "precio": 45.00,
  "stock": 15,
  "imagenUrl": "https://ejemplo.com/pothos.jpg"
}
```

**Nota:** El código se genera automáticamente (ej: PL13)

### 5. Actualizar producto
```bash
PUT /api/BIZ-001/productos/PL12
Content-Type: application/json

{
  "precio": 90.00,
  "stock": 12
}
```

### 6. Actualizar solo stock
```bash
PUT /api/BIZ-001/productos/PL12/stock
Content-Type: application/json

{
  "stock": 20
}
```

### 7. Liberar stock reservado manualmente
```bash
POST /api/BIZ-001/productos/PL12/liberar
Content-Type: application/json

{
  "cantidad": 2
}
```

**¿Cuándo usarlo?**
- Cuando un cliente no paga y quieres liberar el stock
- Cuando hay reservas fantasma
- Cuando necesitas ajustar el inventario

### 8. Desactivar producto
```bash
DELETE /api/BIZ-001/productos/PL12
```

**Nota:** No elimina, solo cambia estado a `INACTIVO`

---

## 📊 Consultar Estadísticas

### 1. Estadísticas generales del negocio
```bash
GET /api/BIZ-001/pedidos/stats
```

### 2. Ver clientes registrados
```bash
GET /api/BIZ-001/clientes
```

### 3. Ver historial de un cliente
```bash
GET /api/BIZ-001/clientes/51999999999
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "CLI-123456",
    "whatsapp": "51999999999",
    "nombre": "Juan Perez",
    "telefono": "999999999",
    "direccion": "Av. Arequipa 123",
    "fechaRegistro": "01/11/2024",
    "ultimaCompra": "30/11/2024",
    "pedidos": [
      {
        "id": "PL-123456",
        "fecha": "30/11/2024",
        "total": 85.00,
        "estado": "ENTREGADO"
      }
    ]
  }
}
```

---

## 🔥 Flujo Típico Durante un LIVE

### Preparación (Antes del LIVE)
1. ✅ Verificar stock de productos: `GET /api/BIZ-001/productos?disponible=true`
2. ✅ Crear productos nuevos si es necesario
3. ✅ Tener listos los códigos de los productos a mostrar

### Durante el LIVE
1. **Mostrar producto en cámara**
2. **Hacer broadcast:** `POST /api/BIZ-001/live/broadcast/PL12`
3. **Esperar a que alguien presione "ApartaLo"**
4. **Verificar que se creó el pedido:** `GET /api/BIZ-001/pedidos?estado=PENDIENTE_PAGO&limit=10`

### Después del LIVE
1. **Ver todos los pedidos pendientes:**
   ```bash
   GET /api/BIZ-001/pedidos?estado=PENDIENTE_PAGO
   ```

2. **Esperar vouchers de pago** (automático)

3. **Validar vouchers pendientes:**
   ```bash
   GET /api/BIZ-001/pedidos?estado=PENDIENTE_VALIDACION
   ```

4. **Confirmar pedidos uno por uno:**
   ```bash
   PUT /api/BIZ-001/pedidos/PL-123456/estado
   {"estado": "CONFIRMADO"}
   ```

5. **Cancelar pedidos no pagados (después de 24h):**
   ```bash
   POST /api/BIZ-001/pedidos/PL-123456/cancelar
   {"motivo": "No realizó el pago en 24h"}
   ```

---

## 🚨 Casos Especiales

### Cliente apartó pero no va a pagar
```bash
# Cancelar y liberar stock
POST /api/BIZ-001/pedidos/PL-123456/cancelar
{"motivo": "Cliente canceló la compra"}
```

### Producto agotado después de reservas
```bash
# Ver stock real
GET /api/BIZ-001/productos/PL12

# Si hay reservas fantasma, liberar manualmente
POST /api/BIZ-001/productos/PL12/liberar
{"cantidad": 2}
```

### Cliente envió voucher equivocado
1. Ver el pedido: `GET /api/BIZ-001/pedidos/PL-123456`
2. Agregar observación: 
   ```bash
   PUT /api/BIZ-001/pedidos/PL-123456/estado
   {
     "estado": "PENDIENTE_VALIDACION",
     "observaciones": "Voucher incorrecto - solicitar nuevo"
   }
   ```

### Reporte de ventas del día
```bash
GET /api/BIZ-001/pedidos?fecha=30/11/2024
GET /api/BIZ-001/pedidos/stats
```

---

## 💡 Tips Pro

1. **Usa Postman o Insomnia** para gestionar las requests
2. **Crea colecciones** con las requests más usadas
3. **Monitorea pedidos pendientes** cada 30 minutos
4. **Cancela pedidos no pagados** después de 24h
5. **Valida vouchers rápido** para no perder ventas
6. **Comunica el estado** al cliente por WhatsApp cuando cambia

---

## 🔐 Seguridad

**IMPORTANTE:** Estas APIs no tienen autenticación por defecto. Para producción:

1. Agregar middleware de autenticación
2. Usar tokens JWT o API Keys
3. Limitar acceso solo a IPs autorizadas
4. Agregar rate limiting

---

## 📱 Notificaciones Automáticas (Próximamente)

En versiones futuras podrás configurar:
- Notificación al cliente cuando se confirma su pago
- Notificación cuando el pedido es enviado
- Recordatorio automático si no paga en 12h
- Notificación al admin cuando hay nuevo voucher

---

**Versión:** 1.3.0  
**Fecha:** Noviembre 2024  
**Autor:** Keyla

¿Preguntas? Escribe a soporte@apartalo.com
