# 🧪 INSTRUCCIONES DE PRUEBA - ApartaLo v1.3

## 🚀 Cómo Probar las Nuevas Funcionalidades

---

## 📋 Pre-requisitos

1. ✅ Node.js instalado (v18+)
2. ✅ Variables de entorno configuradas en `.env`
3. ✅ Google Sheets con estructura correcta
4. ✅ WhatsApp Cloud API configurado

---

## 🔧 Instalación

```bash
# 1. Instalar dependencias (si es primera vez)
npm install

# 2. Ejecutar el script de prueba
node test-nuevas-funcionalidades.js

# 3. Iniciar el bot
npm start
```

---

## 🧪 TEST 1: Pedido al presionar "ApartaLo"

### Objetivo:
Verificar que el pedido se crea INMEDIATAMENTE en Excel al reservar.

### Pasos:
1. **Cliente suscribe al LIVE:**
   ```
   Usuario por WhatsApp: "live 5"
   ```

2. **Admin hace broadcast de producto:**
   ```bash
   curl -X POST http://localhost:3000/api/BIZ-001/live/broadcast/PL12
   ```
   
3. **Cliente recibe producto con botón "ApartaLo"**

4. **Cliente presiona "ApartaLo"**

5. **✅ VERIFICAR en Google Sheets:**
   - Ir a: Hoja "Pedidos"
   - Debe haber un nuevo pedido con:
     - ID: `PL-123456` (o similar)
     - Estado: `PENDIENTE_PAGO`
     - Cliente: Nombre del usuario
     - Productos: `PL12:NombreProducto:1:85.00`
     - Total: Precio del producto

6. **✅ VERIFICAR en Inventario:**
   - Ir a: Hoja "Inventario"
   - Fila del producto PL12
   - Columna `StockReservado` debe haber aumentado en 1

### ✅ Resultado Esperado:
El cliente recibe:
```
✅ ¡LO APARTASTE!

Monstera Variegata
S/85.00

📦 Pedido: PL-123456
Estado: PENDIENTE_PAGO

💳 Realiza tu pago y envia el voucher para confirmar tu pedido.
```

---

## 🧪 TEST 2: Ver Pedidos al Volver

### Objetivo:
Verificar que el cliente ve su historial al escribir "hola".

### Pasos:

1. **Cliente con pedidos existentes escribe:**
   ```
   Usuario por WhatsApp: "hola"
   ```

2. **✅ VERIFICAR que recibe:**
   ```
   📦 TUS PEDIDOS ACTIVOS:

   1. PL-123456
      Estado: ⏳ Pendiente de pago
      Total: S/85.00
      Fecha: 30/11/2024

   2. PL-789012
      Estado: 🔍 Validando voucher
      Total: S/120.00
      Fecha: 29/11/2024

   Escribe el codigo del pedido para ver detalles.
   ```

3. **Cliente escribe código:**
   ```
   Usuario por WhatsApp: "PL-123456"
   ```

4. **✅ VERIFICAR que recibe detalle completo:**
   ```
   📦 DETALLE DEL PEDIDO

   Codigo: PL-123456
   Estado: ⏳ Pendiente de pago
   Fecha: 30/11/2024 15:30:25

   Productos:
   - 1x Monstera Variegata - S/85.00

   Total: S/85.00

   Entrega en:
   Av. Arequipa 123, Miraflores

   💳 Envia tu voucher de pago para confirmar el pedido.
   ```

### ✅ Resultado Esperado:
- Cliente ve SOLO pedidos activos (no entregados ni cancelados)
- Puede consultar detalles escribiendo el código
- Recibe información completa y clara

---

## 🧪 TEST 3: Mensaje del LIVE Optimizado

### Objetivo:
Verificar que el mensaje del LIVE no muestra "personas conectadas".

### Pasos:

1. **Cliente se suscribe:**
   ```
   Usuario por WhatsApp: "live 5"
   ```

2. **✅ VERIFICAR el mensaje recibido:**
   ```
   🔴 ESTAS EN EL LIVE

   Plants & Life
   Duracion: 5 minutos

   ✨ Recibiras los productos en tiempo real
   ⚡ El primero en tocar "ApartaLo" se lo lleva

   Escribe "salir" para desconectarte
   ```

3. **❌ NO debe aparecer:**
   - "Conectados: X personas"
   - Información redundante

### ✅ Resultado Esperado:
Mensaje limpio, directo y sin información innecesaria.

---

## 🧪 TEST 4: Envío de Voucher

### Objetivo:
Verificar que el voucher se registra correctamente.

### Pasos:

1. **Cliente con pedido PENDIENTE_PAGO envía imagen**

2. **✅ VERIFICAR en Google Sheets:**
   - Estado del pedido cambió a: `PENDIENTE_VALIDACION`
   - Columna `VoucherURL` tiene la URL de la imagen

3. **Cliente recibe confirmación:**
   ```
   Voucher recibido!

   Tu pedido PL-123456 esta siendo verificado.

   Te notificaremos cuando sea confirmado.

   Gracias por tu compra!
   ```

### ✅ Resultado Esperado:
- Estado actualizado a `PENDIENTE_VALIDACION`
- URL del voucher guardada en Excel

---

## 🧪 TEST 5: Cancelar Pedido y Liberar Stock

### Objetivo:
Verificar que al cancelar un pedido se libera el stock.

### Pasos:

1. **Admin cancela pedido:**
   ```bash
   curl -X POST http://localhost:3000/api/BIZ-001/pedidos/PL-123456/cancelar \
     -H "Content-Type: application/json" \
     -d '{"motivo": "Cliente no realizo el pago"}'
   ```

2. **✅ VERIFICAR en Google Sheets - Pedidos:**
   - Estado cambió a: `CANCELADO`
   - Observaciones: "CANCELADO: Cliente no realizo el pago"

3. **✅ VERIFICAR en Google Sheets - Inventario:**
   - `StockReservado` disminuyó
   - Producto vuelve a estar disponible

### ✅ Resultado Esperado:
- Pedido cancelado
- Stock liberado automáticamente

---

## 🧪 TEST 6: Consultar Pedidos por API

### Objetivo:
Verificar que el admin puede consultar pedidos fácilmente.

### Pasos:

1. **Ver pedidos pendientes de pago:**
   ```bash
   curl http://localhost:3000/api/BIZ-001/pedidos?estado=PENDIENTE_PAGO
   ```

2. **Ver pedidos pendientes de validación:**
   ```bash
   curl http://localhost:3000/api/BIZ-001/pedidos?estado=PENDIENTE_VALIDACION
   ```

3. **Ver estadísticas:**
   ```bash
   curl http://localhost:3000/api/BIZ-001/pedidos/stats
   ```

### ✅ Resultado Esperado:
API devuelve JSON con la información correcta.

---

## 🎯 Checklist Final

Marca cada test completado:

- [ ] ✅ TEST 1: Pedido se crea al presionar "ApartaLo"
- [ ] ✅ TEST 2: Cliente ve pedidos al escribir "hola"
- [ ] ✅ TEST 3: Mensaje del LIVE optimizado
- [ ] ✅ TEST 4: Voucher se registra correctamente
- [ ] ✅ TEST 5: Cancelar pedido libera stock
- [ ] ✅ TEST 6: API de admin funciona

---

## 🐛 Problemas Comunes

### 1. "No se crea el pedido en Excel"

**Posibles causas:**
- ❌ Google Service Account sin permisos
- ❌ SpreadsheetID incorrecto
- ❌ Estructura de hojas incorrecta

**Solución:**
1. Verificar que el email de Service Account tiene acceso al spreadsheet
2. Verificar que existe la hoja "Pedidos" con los headers correctos
3. Revisar logs del servidor

### 2. "Cliente no recibe mensajes"

**Posibles causas:**
- ❌ WHATSAPP_TOKEN incorrecto
- ❌ WHATSAPP_PHONE_ID incorrecto
- ❌ Webhook no configurado

**Solución:**
1. Verificar variables en `.env`
2. Verificar que el webhook está configurado en Meta
3. Probar en modo desarrollo: `NODE_ENV=development npm start`

### 3. "Stock no se reserva"

**Posibles causas:**
- ❌ Producto no existe
- ❌ Stock insuficiente

**Solución:**
1. Verificar en la hoja "Inventario" que el producto existe
2. Verificar que `Stock - StockReservado > 0`

---

## 📊 Monitoreo

### Logs importantes a revisar:

```bash
# Durante el LIVE
🔴 Usuario Test suscrito al LIVE de BIZ-001 por 5 min
📢 Producto publicado en LIVE: PL12 - Monstera
🎉 ¡RESERVADO! PL12 para Usuario Test
✅ Pedido creado: PL-123456

# Durante uso normal
📱 Mensaje de 51999999999: hola
📦 Mostrando 2 pedidos pendientes
```

### Comandos útiles:

```bash
# Ver logs en tiempo real
npm start | grep "📦\|🔴\|✅"

# Ejecutar en modo desarrollo (logs detallados)
NODE_ENV=development npm start
```

---

## 🚀 Listo para Producción

Antes de pasar a producción:

1. [ ] Todos los tests pasaron
2. [ ] Variables de entorno de producción configuradas
3. [ ] Webhook configurado en Meta (URL pública)
4. [ ] Google Sheets con datos reales
5. [ ] Números de WhatsApp de prueba funcionando
6. [ ] Backup de la base de datos (Google Sheets)

---

## 📞 Soporte

Si encuentras algún problema:
1. Revisa los logs del servidor
2. Verifica la configuración de Google Sheets
3. Prueba con el script: `node test-nuevas-funcionalidades.js`
4. Consulta la documentación: `GUIA_ADMIN.md`

---

**Última actualización:** 30 de Noviembre, 2024  
**Versión:** 1.3.0  
**Estado:** ✅ Listo para testing
