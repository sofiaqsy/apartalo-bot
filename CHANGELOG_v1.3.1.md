# Cambios v1.3.1 - Sistema de Pedidos Agrupados

## Descripción del Commit

```
feat: agrupar múltiples productos en un solo pedido con pago diferido

- Primer producto apartado crea el pedido en Excel inmediatamente
- Productos adicionales se agregan al mismo pedido existente
- Usuario puede apartar varios productos antes de pagar
- Recordatorio de 30 minutos para completar el pago
- Mostrar cuentas bancarias del negocio al solicitar pago
- Botón "Enviar comprobante" para facilitar envío de voucher
- Pedido activo se mantiene hasta que se envía el voucher
```

## Cambios Implementados

### 1. Nueva Columna en Spreadsheet Maestro
- **Columna I**: `CuentasBancarias`
- Formato: `Banco:Numero|Banco:Numero`
- Ejemplo: `BCP:19123456789|Interbank:8989898989`

### 2. Lógica de Agrupación de Productos
**Antes:**
- Cada producto iba al carrito en memoria
- Pedido se creaba al presionar "Pagar"

**Ahora:**
- ✅ Primer producto apartado → Crea pedido en Excel
- ✅ Productos adicionales → Se agregan al pedido existente
- ✅ Estado: `PENDIENTE_PAGO` hasta que envíe voucher
- ✅ Pedido activo guardado en sesión del usuario

### 3. Nuevas Funciones en sheets-service.js
```javascript
// Agregar producto a un pedido existente
async addProductToOrder(businessId, pedidoId, newItem)
```

### 4. Nuevas Funciones en state-manager.js
```javascript
// Guardar/obtener pedido activo del usuario
setActivePedido(phoneNumber, businessId, pedidoId)
getActivePedido(phoneNumber)
clearActivePedido(phoneNumber)
```

### 5. Mostrar Cuentas Bancarias
Cuando el usuario consulta un pedido `PENDIENTE_PAGO`:
```
💳 CUENTAS PARA PAGAR:

🏦 BCP
   191-2345678-9-10

🏦 Interbank
   898-9898989

⏰ Tienes 30 minutos para completar el pago

[Botón: Enviar comprobante]
```

### 6. Botón "Enviar Comprobante"
- Aparece solo en pedidos `PENDIENTE_PAGO`
- Al presionarlo, solicita el envío de la foto del voucher
- Facilita el proceso sin que el usuario tenga que escribir

## Flujo Técnico

### Apartado del Primer Producto
```
Usuario presiona "ApartaLo"
    ↓
Se verifica si tiene pedido activo
    ↓
NO tiene → Crear nuevo pedido en Excel
    ↓
Guardar pedidoId en sesión del usuario
    ↓
Reservar stock del producto
    ↓
Mostrar: "📦 Pedido creado: PL-123456"
         "⏰ Tienes 30 minutos para pagar"
```

### Apartado de Productos Adicionales
```
Usuario presiona "ApartaLo" (otro producto)
    ↓
Se verifica si tiene pedido activo
    ↓
SÍ tiene → Agregar producto al pedido existente
    ↓
Actualizar total en Excel
    ↓
Reservar stock del nuevo producto
    ↓
Mostrar: "📦 Agregado al pedido: PL-123456"
         "🛒 Productos en tu pedido: 3"
         "Total: S/255.00"
```

### Consulta del Pedido
```
Usuario presiona "Ver pedido" o escribe código
    ↓
Mostrar detalle completo del pedido
    ↓
Si estado = PENDIENTE_PAGO:
    ↓
Mostrar cuentas bancarias del negocio
    ↓
Mostrar botón "Enviar comprobante"
```

### Envío de Voucher
```
Usuario presiona "Enviar comprobante"
    ↓
Bot solicita foto del voucher
    ↓
Usuario envía imagen
    ↓
Estado cambia a PENDIENTE_VALIDACION
    ↓
Se limpia el pedido activo (clearActivePedido)
    ↓
Usuario puede crear un nuevo pedido
```

## Ventajas de Este Enfoque

### ✅ Trazabilidad Inmediata
- Cada apartado queda registrado en Excel desde el segundo 1
- No se pierde información si el servidor se reinicia
- El vendedor puede ver las reservas en tiempo real

### ✅ Flexibilidad para el Usuario
- Puede apartar varios productos sin prisa
- Decide cuándo pagar (tiene 30 minutos)
- No necesita completar datos hasta que pague

### ✅ Un Solo Pedido
- Todos los productos apartados en un LIVE van al mismo pedido
- Facilita el seguimiento y logística
- Un solo voucher para todo

### ✅ Mejor UX
- Botón "Enviar comprobante" evita confusiones
- Cuentas bancarias siempre visibles
- Recordatorio claro de 30 minutos

## Configuración Necesaria

### En el Spreadsheet MAESTRO:
1. Agregar columna **I: CuentasBancarias**
2. Formato: `Banco:Numero|Banco:Numero`
3. Ejemplo:
   ```
   BCP:191-2345678-9-10|Interbank:898-9898989|Yape:999888777
   ```

### En el Código:
Ya está todo implementado, solo necesitas:
1. Actualizar el spreadsheet con la nueva columna
2. Agregar las cuentas bancarias de cada negocio
3. Reiniciar el bot

## Testing

### Test 1: Primer Producto
```
1. Usuario: "live 5"
2. Admin: Broadcast de PL01
3. Usuario: Presiona "ApartaLo"
4. ✅ Verificar: Nuevo pedido en Excel con estado PENDIENTE_PAGO
5. ✅ Verificar: Stock reservado
```

### Test 2: Agregar Más Productos
```
1. Admin: Broadcast de PL02
2. Usuario: Presiona "ApartaLo"
3. ✅ Verificar: Se agregó al mismo pedido (misma fila en Excel)
4. ✅ Verificar: Total actualizado
5. ✅ Verificar: Mensaje dice "Agregado al pedido: PL-123456"
```

### Test 3: Ver Cuentas y Enviar Voucher
```
1. Usuario: Presiona "Ver pedido"
2. ✅ Verificar: Muestra cuentas bancarias
3. ✅ Verificar: Muestra botón "Enviar comprobante"
4. Usuario: Presiona botón
5. Usuario: Envía foto
6. ✅ Verificar: Estado cambió a PENDIENTE_VALIDACION
7. ✅ Verificar: Pedido activo limpiado (puede crear nuevo)
```

## Archivos Modificados

1. ✅ `sheets-service.js` - Nueva función `addProductToOrder()`
2. ✅ `state-manager.js` - Gestión de pedido activo
3. ✅ `message-handler.js` - Lógica de agrupación y cuentas
4. ✅ `README.md` - Documentación actualizada

## Notas Importantes

### ⏰ Timer de 30 Minutos
- Es solo informativo por ahora
- El pedido NO se cancela automáticamente
- El admin debe cancelar manualmente pedidos no pagados
- **Futura mejora:** Agregar cancelación automática

### 🔄 Reutilización del Pedido Activo
- El pedido activo se mantiene durante toda la sesión
- Se limpia solo cuando:
  1. Usuario envía voucher
  2. Admin cancela el pedido
  3. Sesión expira (30 min de inactividad)

### 📊 En el Excel
**Columna H (Productos):** Formato separado por `|`
```
PL01:Monstera:1:85.00|PL02:Pothos:1:45.00|PL03:Ficus:2:60.00
```

**Columna I (Total):** Se actualiza con cada producto agregado

---

**Versión:** 1.3.1  
**Fecha:** 30 de Noviembre, 2024  
**Estado:** ✅ Implementado y listo para testing
