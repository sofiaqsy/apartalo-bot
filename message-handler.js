/**
 * Message Handler - Router Principal
 * Maneja el flujo de conversacion multi-negocio
 */

const stateManager = require('./state-manager');
const sheetsService = require('./sheets-service');
const whatsappService = require('./whatsapp-service');
const config = require('./config');

class MessageHandler {
    constructor() {
        console.log('📱 MessageHandler inicializado');
    }
    
    async handleMessage(from, body, mediaUrl = null) {
        const mensaje = body.trim();
        const mensajeLower = mensaje.toLowerCase();
        const session = stateManager.getSession(from);
        
        console.log(`\n📨 Mensaje de ${from}`);
        console.log(`   Texto: ${mensaje}`);
        console.log(`   Step: ${session.step}`);
        console.log(`   Business: ${session.businessId || 'ninguno'}`);
        
        // COMANDOS GLOBALES
        if (mensajeLower === 'inicio' || mensajeLower === 'home') {
            stateManager.resetSession(from);
            return await this.mostrarBienvenida(from);
        }
        
        if (mensajeLower === 'negocios' || mensajeLower === 'cambiar') {
            stateManager.setStep(from, 'seleccionar_negocio');
            return await this.mostrarListaNegocios(from);
        }
        
        if (mensajeLower === 'carrito') {
            if (!session.businessId) {
                return await this.mostrarBienvenida(from);
            }
            return await this.mostrarCarrito(from, session.businessId);
        }
        
        if (mensajeLower === 'pagar') {
            if (!session.businessId) {
                return await this.mostrarBienvenida(from);
            }
            return await this.iniciarPago(from, session.businessId);
        }
        
        if (mensajeLower === 'cancelar') {
            if (session.businessId) {
                stateManager.clearCart(from, session.businessId);
            }
            stateManager.resetSession(from);
            return await this.mostrarMenuNegocio(from, session.businessId);
        }
        
        // FLUJO PRINCIPAL
        switch (session.step) {
            case 'inicio':
                return await this.mostrarBienvenida(from);
                
            case 'seleccionar_negocio':
                return await this.procesarSeleccionNegocio(from, mensaje);
                
            case 'menu_negocio':
                return await this.procesarMenuNegocio(from, mensaje);
                
            case 'esperando_codigo':
                return await this.procesarCodigoProducto(from, mensaje);
                
            case 'cantidad_producto':
                return await this.procesarCantidad(from, mensaje);
                
            case 'datos_nombre':
                return await this.procesarDatosNombre(from, mensaje);
                
            case 'datos_direccion':
                return await this.procesarDatosDireccion(from, mensaje);
                
            case 'datos_telefono':
                return await this.procesarDatosTelefono(from, mensaje);
                
            case 'esperando_voucher':
                return await this.procesarVoucher(from, mensaje, mediaUrl);
                
            default:
                if (session.businessId) {
                    return await this.procesarCodigoProducto(from, mensaje);
                }
                return await this.mostrarBienvenida(from);
        }
    }
    
    // BIENVENIDA Y SELECCION DE NEGOCIO
    
    async mostrarBienvenida(from) {
        const negocios = sheetsService.getBusinesses();
        
        if (negocios.length === 0) {
            return await whatsappService.sendMessage(from,
                `Hola! Bienvenido a *${config.platform.name}*\n\n` +
                `En este momento no hay negocios disponibles.\n` +
                `Por favor, intenta mas tarde.`
            );
        }
        
        if (negocios.length === 1) {
            const negocio = negocios[0];
            stateManager.setActiveBusiness(from, negocio.id);
            stateManager.subscribe(from, negocio.id);
            return await this.mostrarMenuNegocio(from, negocio.id);
        }
        
        stateManager.setStep(from, 'seleccionar_negocio');
        return await this.mostrarListaNegocios(from);
    }
    
    async mostrarListaNegocios(from) {
        const negocios = sheetsService.getBusinesses();
        
        let mensaje = `🛍️ *${config.platform.name}*\n\n`;
        mensaje += `Con que negocio quieres comprar hoy?\n\n`;
        
        negocios.forEach((neg, idx) => {
            mensaje += `*${idx + 1}.* ${neg.nombre}\n`;
            if (neg.descripcion) {
                mensaje += `   _${neg.descripcion}_\n`;
            }
        });
        
        mensaje += `\n📝 Escribe el numero del negocio`;
        
        if (negocios.length <= 3) {
            const botones = negocios.map(neg => ({ title: neg.nombre.substring(0, 20) }));
            return await whatsappService.sendButtonMessage(from, mensaje, botones);
        }
        
        return await whatsappService.sendMessage(from, mensaje);
    }
    
    async procesarSeleccionNegocio(from, mensaje) {
        const negocios = sheetsService.getBusinesses();
        let negocioSeleccionado = null;
        
        const numero = parseInt(mensaje);
        if (!isNaN(numero) && numero > 0 && numero <= negocios.length) {
            negocioSeleccionado = negocios[numero - 1];
        }
        
        if (!negocioSeleccionado) {
            negocioSeleccionado = negocios.find(n => 
                n.nombre.toLowerCase().includes(mensaje.toLowerCase())
            );
        }
        
        if (!negocioSeleccionado) {
            return await whatsappService.sendMessage(from,
                `No encontre ese negocio.\n\n` +
                `Escribe el numero del negocio o su nombre.`
            );
        }
        
        stateManager.setActiveBusiness(from, negocioSeleccionado.id);
        stateManager.subscribe(from, negocioSeleccionado.id);
        
        return await this.mostrarMenuNegocio(from, negocioSeleccionado.id);
    }
    
    // MENU DEL NEGOCIO
    
    async mostrarMenuNegocio(from, businessId) {
        const negocio = sheetsService.getBusiness(businessId);
        if (!negocio) {
            return await this.mostrarBienvenida(from);
        }
        
        const cart = stateManager.getCart(from, businessId);
        const cartTotal = stateManager.getCartTotal(from, businessId);
        
        let mensaje = `🏪 *${negocio.nombre}*\n\n`;
        
        if (cart.length > 0) {
            mensaje += `🛒 Tienes *${cart.length} producto(s)* en tu carrito\n`;
            mensaje += `💰 Total: *S/${cartTotal.toFixed(2)}*\n\n`;
        }
        
        mensaje += `*Viste algo en el live?*\n`;
        mensaje += `Escribe el codigo del producto para reservarlo.\n\n`;
        mensaje += `_Ejemplo: ${negocio.prefijo}01_`;
        
        stateManager.setStep(from, 'esperando_codigo');
        
        const botones = cart.length > 0 
            ? [{ title: 'Ver carrito' }, { title: 'Pagar' }, { title: 'Cambiar negocio' }]
            : [{ title: 'Cambiar negocio' }];
        
        return await whatsappService.sendButtonMessage(from, mensaje, botones);
    }
    
    async procesarMenuNegocio(from, mensaje) {
        const session = stateManager.getSession(from);
        const mensajeLower = mensaje.toLowerCase();
        
        if (mensajeLower === 'ver carrito') {
            return await this.mostrarCarrito(from, session.businessId);
        }
        
        if (mensajeLower === 'pagar') {
            return await this.iniciarPago(from, session.businessId);
        }
        
        if (mensajeLower === 'cambiar negocio') {
            stateManager.setStep(from, 'seleccionar_negocio');
            return await this.mostrarListaNegocios(from);
        }
        
        return await this.procesarCodigoProducto(from, mensaje);
    }
    
    // PRODUCTOS Y RESERVAS
    
    async procesarCodigoProducto(from, mensaje) {
        const session = stateManager.getSession(from);
        const businessId = session.businessId;
        
        if (!businessId) {
            return await this.mostrarBienvenida(from);
        }
        
        const codigo = mensaje.toUpperCase().trim();
        const producto = await sheetsService.getProductByCode(businessId, codigo);
        
        if (!producto) {
            return await whatsappService.sendMessage(from,
                `❌ Codigo *${codigo}* no encontrado.\n\n` +
                `Verifica el codigo del producto del live y escribelo nuevamente.`
            );
        }
        
        let mensaje_producto = `✅ *${producto.nombre}*\n\n`;
        mensaje_producto += `📝 ${producto.descripcion || 'Sin descripcion'}\n`;
        mensaje_producto += `💰 Precio: *S/${producto.precio.toFixed(2)}*\n`;
        mensaje_producto += `📦 Disponible: ${producto.disponible} unidades\n\n`;
        mensaje_producto += `Cuantas unidades quieres reservar?`;
        
        stateManager.setStep(from, 'cantidad_producto', { 
            productoActual: producto 
        });
        
        if (producto.imagenUrl) {
            await whatsappService.sendImageMessage(from, producto.imagenUrl, mensaje_producto);
        } else {
            await whatsappService.sendMessage(from, mensaje_producto);
        }
    }
    
    async procesarCantidad(from, mensaje) {
        const session = stateManager.getSession(from);
        const producto = session.data?.productoActual;
        
        if (!producto) {
            return await this.mostrarMenuNegocio(from, session.businessId);
        }
        
        const cantidad = parseInt(mensaje);
        
        if (isNaN(cantidad) || cantidad < 1) {
            return await whatsappService.sendMessage(from,
                `Por favor, ingresa un numero valido.\n\n` +
                `Cuantas unidades de *${producto.nombre}* quieres?`
            );
        }
        
        if (cantidad > producto.disponible) {
            return await whatsappService.sendMessage(from,
                `❌ Solo hay *${producto.disponible}* unidades disponibles.\n\n` +
                `Cuantas quieres reservar?`
            );
        }
        
        const resultado = await sheetsService.reserveStock(session.businessId, producto.codigo, cantidad);
        
        if (!resultado.success) {
            return await whatsappService.sendMessage(from,
                `❌ ${resultado.error}\n\n` +
                `Intenta con otra cantidad o escribe otro codigo.`
            );
        }
        
        stateManager.addToCart(from, session.businessId, {
            codigo: producto.codigo,
            nombre: producto.nombre,
            cantidad: cantidad,
            precio: producto.precio
        });
        
        const cart = stateManager.getCart(from, session.businessId);
        const cartTotal = stateManager.getCartTotal(from, session.businessId);
        
        let respuesta = `✅ *Reservado!*\n\n`;
        respuesta += `${cantidad}x ${producto.nombre}\n`;
        respuesta += `Subtotal: S/${(cantidad * producto.precio).toFixed(2)}\n\n`;
        respuesta += `🛒 *Tu carrito (${cart.length} productos)*\n`;
        respuesta += `Total: *S/${cartTotal.toFixed(2)}*\n\n`;
        respuesta += `Que deseas hacer?`;
        
        stateManager.setStep(from, 'esperando_codigo');
        
        return await whatsappService.sendButtonMessage(from, respuesta, [
            { title: 'Seguir comprando' },
            { title: 'Pagar' },
            { title: 'Ver carrito' }
        ]);
    }
    
    // CARRITO
    
    async mostrarCarrito(from, businessId) {
        const cart = stateManager.getCart(from, businessId);
        const negocio = sheetsService.getBusiness(businessId);
        
        if (cart.length === 0) {
            return await whatsappService.sendMessage(from,
                `🛒 Tu carrito esta vacio.\n\n` +
                `Escribe el codigo de un producto del live para agregarlo.`
            );
        }
        
        let mensaje = `🛒 *Tu carrito en ${negocio.nombre}*\n\n`;
        
        cart.forEach((item, idx) => {
            mensaje += `${idx + 1}. *${item.nombre}*\n`;
            mensaje += `   ${item.cantidad} x S/${item.precio.toFixed(2)} = S/${item.subtotal.toFixed(2)}\n\n`;
        });
        
        const total = stateManager.getCartTotal(from, businessId);
        mensaje += `━━━━━━━━━━━━━━━━━\n`;
        mensaje += `*TOTAL: S/${total.toFixed(2)}*\n\n`;
        mensaje += `_Escribe otro codigo para agregar mas productos_`;
        
        stateManager.setStep(from, 'esperando_codigo');
        
        return await whatsappService.sendButtonMessage(from, mensaje, [
            { title: 'Pagar' },
            { title: 'Seguir comprando' },
            { title: 'Vaciar carrito' }
        ]);
    }
    
    // PROCESO DE PAGO
    
    async iniciarPago(from, businessId) {
        const cart = stateManager.getCart(from, businessId);
        
        if (cart.length === 0) {
            return await whatsappService.sendMessage(from,
                `🛒 Tu carrito esta vacio.\n\n` +
                `Escribe el codigo de un producto para agregarlo.`
            );
        }
        
        const clienteCache = stateManager.getCachedClient(from, businessId);
        const clienteSheets = await sheetsService.findClient(businessId, from);
        const cliente = clienteSheets || clienteCache;
        
        if (cliente && cliente.nombre && cliente.direccion) {
            return await this.confirmarDatosCliente(from, businessId, cliente);
        }
        
        stateManager.setStep(from, 'datos_nombre');
        
        return await whatsappService.sendMessage(from,
            `📝 *Datos para tu pedido*\n\n` +
            `Paso 1 de 3\n\n` +
            `Cual es tu *nombre completo*?`
        );
    }
    
    async confirmarDatosCliente(from, businessId, cliente) {
        const cart = stateManager.getCart(from, businessId);
        const total = stateManager.getCartTotal(from, businessId);
        
        let mensaje = `📦 *Confirma tu pedido*\n\n`;
        
        mensaje += `*Productos:*\n`;
        cart.forEach(item => {
            mensaje += `• ${item.cantidad}x ${item.nombre} - S/${item.subtotal.toFixed(2)}\n`;
        });
        mensaje += `\n*Total: S/${total.toFixed(2)}*\n\n`;
        
        mensaje += `*Datos de entrega:*\n`;
        mensaje += `👤 ${cliente.nombre}\n`;
        mensaje += `📍 ${cliente.direccion}\n`;
        mensaje += `📱 ${cliente.telefono || 'No registrado'}\n\n`;
        
        mensaje += `Los datos son correctos?`;
        
        stateManager.setStep(from, 'confirmar_pedido', { cliente });
        
        return await whatsappService.sendButtonMessage(from, mensaje, [
            { title: 'Si, confirmar' },
            { title: 'Editar datos' },
            { title: 'Cancelar' }
        ]);
    }
    
    async procesarDatosNombre(from, mensaje) {
        const nombre = mensaje.trim();
        
        if (nombre.length < 2) {
            return await whatsappService.sendMessage(from,
                `Por favor, ingresa tu nombre completo.`
            );
        }
        
        stateManager.setStep(from, 'datos_direccion', { nombre });
        
        return await whatsappService.sendMessage(from,
            `✅ Nombre: *${nombre}*\n\n` +
            `Paso 2 de 3\n\n` +
            `Cual es tu *direccion completa* de entrega?\n` +
            `_Incluye distrito y referencia_`
        );
    }
    
    async procesarDatosDireccion(from, mensaje) {
        const direccion = mensaje.trim();
        
        if (direccion.length < 10) {
            return await whatsappService.sendMessage(from,
                `Por favor, ingresa una direccion mas completa.\n` +
                `Incluye calle, numero, distrito y referencia.`
            );
        }
        
        stateManager.setStep(from, 'datos_telefono', { direccion });
        
        return await whatsappService.sendMessage(from,
            `✅ Direccion: *${direccion}*\n\n` +
            `Paso 3 de 3\n\n` +
            `Cual es tu *numero de telefono* de contacto?`
        );
    }
    
    async procesarDatosTelefono(from, mensaje) {
        const session = stateManager.getSession(from);
        const telefono = mensaje.replace(/[^0-9]/g, '');
        
        if (telefono.length < 7) {
            return await whatsappService.sendMessage(from,
                `Por favor, ingresa un numero de telefono valido.`
            );
        }
        
        const cliente = {
            nombre: session.data.nombre,
            direccion: session.data.direccion,
            telefono: telefono,
            whatsapp: from
        };
        
        stateManager.cacheClient(from, session.businessId, cliente);
        await sheetsService.saveClient(session.businessId, cliente);
        
        return await this.crearPedido(from, session.businessId, cliente);
    }
    
    async crearPedido(from, businessId, cliente) {
        const cart = stateManager.getCart(from, businessId);
        const total = stateManager.getCartTotal(from, businessId);
        const negocio = sheetsService.getBusiness(businessId);
        
        const resultado = await sheetsService.createOrder(businessId, {
            whatsapp: from,
            cliente: cliente.nombre,
            telefono: cliente.telefono,
            direccion: cliente.direccion,
            items: cart,
            total: total
        });
        
        if (!resultado.success) {
            return await whatsappService.sendMessage(from,
                `❌ Error creando el pedido. Por favor, intenta nuevamente.`
            );
        }
        
        stateManager.clearCart(from, businessId);
        
        let mensaje = `🎉 *Pedido creado!*\n\n`;
        mensaje += `📦 Codigo: *${resultado.pedidoId}*\n\n`;
        mensaje += `*Productos:*\n`;
        cart.forEach(item => {
            mensaje += `• ${item.cantidad}x ${item.nombre}\n`;
        });
        mensaje += `\n*Total: S/${total.toFixed(2)}*\n\n`;
        mensaje += `📍 *Entrega en:*\n${cliente.direccion}\n\n`;
        mensaje += `💳 *Para confirmar tu pedido:*\n`;
        mensaje += `Envia el voucher de tu pago a este chat.\n\n`;
        mensaje += `Tienes 30 minutos para completar el pago.`;
        
        stateManager.setStep(from, 'esperando_voucher', { 
            pedidoId: resultado.pedidoId 
        });
        
        return await whatsappService.sendMessage(from, mensaje);
    }
    
    async procesarVoucher(from, mensaje, mediaUrl) {
        const session = stateManager.getSession(from);
        const pedidoId = session.data?.pedidoId;
        
        if (!pedidoId) {
            return await this.mostrarMenuNegocio(from, session.businessId);
        }
        
        if (!mediaUrl) {
            return await whatsappService.sendMessage(from,
                `📸 Por favor, envia una *imagen* de tu voucher de pago.\n\n` +
                `Tu codigo de pedido es: *${pedidoId}*`
            );
        }
        
        await sheetsService.updateOrderStatus(
            session.businessId, 
            pedidoId, 
            'PENDIENTE_VALIDACION',
            mediaUrl
        );
        
        stateManager.setStep(from, 'esperando_codigo');
        
        return await whatsappService.sendMessage(from,
            `✅ *Voucher recibido!*\n\n` +
            `Tu pedido *${pedidoId}* esta siendo verificado.\n\n` +
            `Te notificaremos cuando sea confirmado.\n\n` +
            `Gracias por tu compra! 🎉`
        );
    }
}

module.exports = new MessageHandler();
