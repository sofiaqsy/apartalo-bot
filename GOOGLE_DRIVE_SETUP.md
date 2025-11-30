# 📸 Subida de Vouchers a Google Drive

## Cambios Implementados

### ✅ Nueva Funcionalidad
Ahora cuando el usuario envía una imagen del comprobante de pago:
1. ✅ La imagen se descarga de WhatsApp
2. ✅ Se sube automáticamente a Google Drive
3. ✅ Se guarda el link de Drive en el Excel (columna VoucherURL)
4. ✅ El archivo queda público para que el admin pueda verlo

## Configuración Necesaria

### 1. Crear Carpeta en Google Drive (Opcional)

1. Ir a [Google Drive](https://drive.google.com)
2. Crear una carpeta llamada "ApartaLo Vouchers" o el nombre que prefieras
3. Hacer clic derecho → Compartir
4. Agregar el email de tu Service Account con permisos de "Editor"
5. Copiar el ID de la carpeta (está en la URL):
   ```
   https://drive.google.com/drive/folders/1A2B3C4D5E6F7G8H9I0J
                                           ↑ Este es el ID
   ```

### 2. Agregar Variable de Entorno

En tu archivo `.env`, agrega:

```env
# ID de carpeta de Google Drive para vouchers
GOOGLE_DRIVE_FOLDER_ID=1A2B3C4D5E6F7G8H9I0J
```

**Nota:** Si no agregas esta variable, los vouchers se guardarán en la raíz de Drive.

### 3. Verificar Permisos de Service Account

Tu Service Account necesita permisos de Google Drive. Ya está configurado en el código con el scope:
```javascript
'https://www.googleapis.com/auth/drive.file'
```

## Flujo de Subida

```
Usuario envía imagen
    ↓
Bot: "⏳ Procesando tu comprobante..."
    ↓
Descargar imagen de WhatsApp Cloud API
    ↓
Subir imagen a Google Drive
    ↓
Hacer el archivo público (permisos de lectura)
    ↓
Guardar link en Excel
    ↓
Bot: "✅ Voucher recibido!"
```

## Estructura del Link Guardado

En la columna `VoucherURL` del Excel se guarda:
```
https://drive.google.com/uc?export=view&id=FILE_ID
```

Este link permite:
- ✅ Ver la imagen directamente en el navegador
- ✅ Incrustar la imagen en otras aplicaciones
- ✅ Compartir con el admin sin restricciones

## Nombre de Archivos

Los archivos se guardan con el formato:
```
voucher_PEDIDO-ID_TIMESTAMP.jpg
```

Ejemplo:
```
voucher_PL-874271_1701363456789.jpg
```

Esto permite:
- Identificar fácilmente a qué pedido pertenece
- Evitar conflictos de nombres
- Ordenar por fecha de subida

## Verificar que Funciona

### Test 1: Envío de Voucher
```
1. Usuario tiene pedido pendiente de pago
2. Usuario presiona "Enviar comprobante"
3. Usuario envía imagen
4. Bot responde: "⏳ Procesando tu comprobante..."
5. ✅ Verificar: Bot responde "✅ Voucher recibido!"
6. ✅ Verificar: En Google Drive aparece el archivo
7. ✅ Verificar: En Excel, columna VoucherURL tiene el link
```

### Test 2: Acceso al Link
```
1. Copiar link de la columna VoucherURL
2. Abrir en navegador
3. ✅ Verificar: Se ve la imagen del voucher
```

### Test 3: Múltiples Vouchers
```
1. Crear varios pedidos
2. Enviar vouchers para cada uno
3. ✅ Verificar: En Drive hay múltiples archivos
4. ✅ Verificar: Cada archivo tiene nombre único
```

## Manejo de Errores

### Error: "Error al descargar la imagen"
**Causa:** Problema con WhatsApp Cloud API
**Solución:** 
- Verificar WHATSAPP_TOKEN
- Verificar que el mediaId es válido
- Revisar logs del servidor

### Error: "Error al guardar el comprobante"
**Causa:** Problema con Google Drive API
**Solución:**
- Verificar permisos del Service Account
- Verificar que la carpeta existe (si especificaste GOOGLE_DRIVE_FOLDER_ID)
- Verificar que el Service Account tiene acceso a la carpeta

### Imagen No Se Ve
**Causa:** Permisos no configurados
**Solución:**
El código automáticamente hace el archivo público, pero si no funciona:
1. Ir a Google Drive
2. Hacer clic derecho en el archivo
3. Compartir → "Cualquier persona con el enlace"

## Ventajas de Este Sistema

### ✅ Centralizado
- Todos los vouchers en un solo lugar (Drive)
- Fácil de organizar y buscar
- No se pierden si el servidor se reinicia

### ✅ Accesible
- Links permanentes que no expiran
- Se pueden ver desde cualquier dispositivo
- Admin puede ver los vouchers directamente desde Excel

### ✅ Escalable
- No hay límite de almacenamiento (15GB gratis en Drive)
- Búsqueda nativa de Google Drive
- Integración con otras herramientas de Google

### ✅ Seguro
- Archivos respaldados en la nube de Google
- Control de permisos por Service Account
- Historial de cambios en Drive

## Estructura en Drive

Recomendada:
```
📁 ApartaLo Vouchers/
    📁 2024-11/
        📄 voucher_PL-874271_1701363456789.jpg
        📄 voucher_PL-874272_1701363567890.jpg
    📁 2024-12/
        📄 voucher_PL-874273_1704042167890.jpg
```

Puedes organizar manualmente por fecha después de que se suban.

## Migración de Vouchers Anteriores

Si ya tienes vouchers guardados con otros sistemas:

### Desde URLs de WhatsApp:
```javascript
// Script para migrar (ejecutar una vez)
const pedidos = await sheetsService.getAllOrders(businessId);

for (const pedido of pedidos) {
    if (pedido.voucherUrl && pedido.voucherUrl.includes('whatsapp')) {
        // Descargar de WhatsApp
        // Subir a Drive
        // Actualizar Excel
    }
}
```

## Optimizaciones Futuras

### Comprimir Imágenes
Agregar compresión antes de subir para ahorrar espacio:
```javascript
const sharp = require('sharp');
const compressedBuffer = await sharp(imageBuffer)
    .resize(1200, 1200, { fit: 'inside' })
    .jpeg({ quality: 85 })
    .toBuffer();
```

### OCR Automático
Extraer datos del voucher automáticamente:
```javascript
const vision = require('@google-cloud/vision');
const [result] = await client.textDetection(imageBuffer);
const detections = result.textAnnotations;
// Extraer monto, banco, fecha, etc.
```

### Notificar al Admin
Enviar notificación automática cuando llegue un voucher:
```javascript
// Enviar email
// Enviar WhatsApp al admin
// Enviar notificación a Telegram
```

---

**Fecha:** 30 de Noviembre, 2024  
**Versión:** 1.3.2  
**Estado:** ✅ Implementado
