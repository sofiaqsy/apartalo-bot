# 📸 Sistema de Múltiples Comprobantes

## Descripción del Cambio

Ahora los usuarios pueden enviar **múltiples comprobantes** para un mismo pedido. Esto es útil para:
- Enviar comprobante corregido si el primero tenía error
- Enviar múltiples transferencias para un pedido
- Agregar voucher adicional si faltó información

## Cambios Implementados

### 1. Estructura de Datos
**Antes (columna K):**
```
VoucherURL: https://drive.google.com/...
```

**Ahora (columna K):**
```
VoucherURLs: https://drive.google.com/...|https://drive.google.com/...|https://drive.google.com/...
```

Los URLs se separan con `|` (pipe).

### 2. Flujo del Usuario

#### Envío de comprobante:
```
Usuario: [envía imagen]
Bot: ✅ Comprobante recibido!
     
     Pedido: PL-874271
     Comprobantes enviados: 1
     
     Tu pedido está siendo verificado.
     
     Te notificaremos cuando sea confirmado.
     
     Gracias por tu compra! 🎉
```

Después de enviar el comprobante:
- El usuario vuelve automáticamente al flujo regular
- Puede seguir comprando escribiendo códigos de productos
- Puede escribir "hola" para ver el menú principal
- Puede escribir "carrito" para ver su carrito

#### Enviar múltiples comprobantes:
Si el usuario necesita enviar otro comprobante para el mismo pedido:

```
Usuario: [envía otra imagen]
Bot: ✅ Comprobante recibido!
     
     Pedido: PL-874271
     Comprobantes enviados: 2
     
     Tu pedido está siendo verificado.
     
     Te notificaremos cuando sea confirmado.
     
     Gracias por tu compra! 🎉
```

El sistema:
- Detecta automáticamente que hay un pedido pendiente
- Agrega el nuevo comprobante al mismo pedido
- Vuelve al flujo regular

### 3. Panel Admin (PWA)

**Visualización:**
- Muestra todos los comprobantes en una cuadrícula (grid)
- Cada imagen es clickeable para ver en Drive
- Indica el número total: "Comprobantes (3)"
- Cada imagen tiene etiqueta: "Comprobante 1", "Comprobante 2", etc.

**Layout:**
- Grid responsive con columnas de min 200px
- Imágenes con sombra y border-radius
- Hover effect para mejor UX

### 4. Búsqueda Automática de Pedido

Si el usuario envía una imagen sin estar en el flujo correcto:
- El sistema busca automáticamente su último pedido pendiente
- Configura la sesión para recibir el voucher
- Agrega el comprobante sin problemas

Estados válidos para recibir más comprobantes:
- `PENDIENTE_PAGO`
- `PENDIENTE_VALIDACION`

## Ventajas

### ✅ Para el Cliente
- Puede corregir comprobantes con errores
- Puede enviar múltiples transferencias
- No pierde su pedido si se equivoca
- Flexibilidad total en el proceso de pago

### ✅ Para el Admin
- Ve todos los comprobantes en un solo lugar
- Puede comparar si hay diferencias
- Detecta fácilmente intentos de fraude
- Mejor trazabilidad del proceso de pago

### ✅ Para el Negocio
- Menos fricción en el proceso de compra
- Menos pedidos cancelados por errores
- Mejor experiencia del cliente
- Mayor conversión de ventas

## Comandos del Usuario

| Comando | Acción |
|---------|--------|
| `[envía imagen]` | Agrega comprobante al pedido pendiente y vuelve al flujo regular |
| `cancelar` | Cancela y limpia el pedido |

## Casos de Uso

### Caso 1: Comprobante Incorrecto
```
1. Usuario envía comprobante con monto incorrecto
2. Se da cuenta del error
3. Envía el comprobante correcto
4. Admin ve ambos y valida el correcto
```

### Caso 2: Múltiples Transferencias
```
1. Usuario debe pagar S/200
2. Transfiere S/100 desde cuenta A
3. Envía comprobante A → Vuelve al flujo regular
4. Usuario recuerda que falta
5. Transfiere S/100 desde cuenta B
6. Envía comprobante B → Sistema detecta pedido pendiente y agrega
7. Admin valida ambos comprobantes
```

### Caso 3: Información Adicional
```
1. Usuario envía comprobante de transferencia
2. Admin solicita foto del voucher físico
3. Usuario envía foto del voucher
4. Ambos comprobantes quedan registrados
```

## Consideraciones Técnicas

### Almacenamiento en Drive
- Cada comprobante tiene un nombre único con timestamp
- Formato: `voucher_PEDIDOID_TIMESTAMP.jpg`
- Ejemplo: `voucher_PL-874271_1701363456789.jpg`

### Límites
- **Teórico:** Ilimitados comprobantes por pedido
- **Recomendado:** Máximo 5 comprobantes por pedido
- **Columna K en Excel:** Límite de ~32,000 caracteres

Si un pedido tiene muchos comprobantes:
- Considerar crear observación con explicación
- Posible refactor a hoja separada "Comprobantes"

### Performance
- Cada imagen se sube individualmente a Drive
- Proceso toma ~3-5 segundos por imagen
- Usuario ve mensaje "Procesando..." durante la subida

## Migración de Datos Antiguos

Si ya tienes pedidos con un solo voucher:
- **No requiere migración**
- El sistema trata un solo URL igual que antes
- Al agregar otro comprobante, se convierte automáticamente a formato múltiple

## Próximas Mejoras

### 1. Límite Configurable
```javascript
const MAX_VOUCHERS_PER_ORDER = 5;
if (vouchersActuales >= MAX_VOUCHERS_PER_ORDER) {
    return await whatsappService.sendMessage(from,
        '⚠️ Ya has enviado el máximo de comprobantes permitidos.\n\n' +
        'Contacta al vendedor si necesitas enviar más.'
    );
}
```

### 2. Eliminar Comprobante
Permitir al admin eliminar comprobantes incorrectos desde el panel PWA.

### 3. Marcar Comprobante Principal
Indicar cuál es el comprobante válido si hay múltiples.

### 4. Notificación al Admin
Enviar notificación cada vez que llegue un nuevo comprobante:
- WhatsApp al admin
- Email
- Notificación push en PWA

---

**Versión:** 1.4.0  
**Fecha:** 30 de Noviembre, 2024  
**Estado:** ✅ Implementado y listo para testing
