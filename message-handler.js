/**
 * Message Handler - Router Principal
 * Maneja el flujo de conversacion multi-negocio con Live Commerce
 */

const stateManager = require('./state-manager');
const sheetsService = require('./sheets-service');
const whatsappService = require('./whatsapp-service');
const liveManager = require('./live-manager');
const config = require('./config');

class MessageHandler {
    constructor() {
        console.log('📱 MessageHandler inicializado con Live Commerce');
    }
    
    async handleMessage(from, body, mediaUrl = null, interactiveData = null) {
        const mensaje = body.trim();
        const mensajeLower = mensaje.toLowerCase();
        const session = stateManager.getSession(from);
        
        console.log(`\n📨 Mensaje de ${from}`);
        console.log(`   Texto: ${mensaje}`);
        console.log(`   Step: ${session.step}`);
        console.log(`   Business: ${session.businessId || 'ninguno'}`);
        if (interactiveData) {
            console.log(`   Interactive: ${JSON.stringify(interactiveData)}`);
        }
        
        // MANEJAR BOTONES INTERACTIVOS (reserva rápida del LIVE)
        if (interactiveData) {
            return await this.handleInteractive(from, interactiveData, session);
        }
        
        // COMANDOS GLOBALES
        if (mensajeLower === 'inicio' || mensajeLower === 'home' || mensajeLower === 'hola') {
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
        
        // COMANDOS DE LIVE
        if (mensajeLower === 'live 5' || mensajeLower === 'live5' || mensajeLower === '🔴 live 5 min') {
            return await this.suscribirAlLive(from, 5);
        }
        
        if (mensajeLower === 'live 10' || mensajeLower === 'live10' || mensajeLower === '🔴 live 10 min') {
            return await this.suscribirAlLive(from, 10);
        }
        
        if (mensajeLower === 'salir live' || mensajeLower === 'salir') {
            return await this.salirDelLive(from);
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
    
    // ========================================
    // LIVE COMMERCE - SUSCRIPCIONES
    // ========================================
    
    async suscribirAlLive(from, minutos) {
        const session = stateManager.getSession(from);
        let businessId = session.businessId;
        
        // Si no hay negocio seleccionado, usar el primero disponible
        if (!businessId) {
            const negocios = sheetsService.getBusinesses();
            if (negocios.length > 0) {
                businessId = negocios[0].id;
                stateManager.setActiveBusiness(from, businessId);
            } else {
                return await whatsappService.sendMessage(from,
                    `❌ No hay negocios disponibles en este momento.`
                );
            }
        }
        
        const negocio = sheetsService.getBusiness(businessId);
        const cliente = await sheetsService.findClient(businessId, from);
        const nombreUsuario = cliente?.nombre || 'Usuario';
        
        liveManager.subscribe(businessId, from, nombreUsuario, minutos);
        
        const subscriberCount = liveManager.getSubscriberCount(businessId);
        
        let mensaje = `🔴 *¡ESTAS EN EL LIVE!*\n\n`;
        mensaje += `📺 ${negocio.nombre}\n`;
        mensaje += `⏱️ Duracion: ${minutos} minutos\n`;
        mensaje += `👥 Conectados: ${subscriberCount} personas\n\n`;
        mensaje += `Recibiras los productos en tiempo real.\n`;
        mensaje += `Cuando veas algo que te gusta, toca *"🛒 ¡LO QUIERO!"* para apartarlo.\n\n`;
        mensaje += `⚡ *¡El primero en tocar se lo lleva!*\n\n`;
        mensaje += `_Escribe "salir" para desconectarte_`;
        
        stateManager.setStep(from, 'en_live');
        
        return await whatsappService.sendMessage(from, mensaje);
    }
    
    async salirDelLive(from) {
        const session = stateManager.getSession(from);
        const businessId = session.businessId;
        
        if (businessId) {
            liveManager.unsubscribe(businessId, from);
        }
        
        stateManager.setStep(from, 'esperando_codigo');
        
        return await whatsappService.sendMessage(from,
            `⚪ Saliste del LIVE.\n\n` +
            `Puedes seguir comprando escribiendo codigos de productos, ` +
            `o escribir *"live 5"* o *"live 10"* para volver a conectarte.`
        );
    }
    
    // ========================================
    // LIVE COMMERCE - BOTONES INTERACTIVOS
    // ========================================
    
    async handleInteractive(from, interactiveData, session) {
        const buttonId = interactiveData.button_reply?.id || '';
        const buttonTitle = interactiveData.button_reply?.title || '';
        
        console.log(`🔘 Boton presionado: ${buttonId} - ${buttonTitle}`);
        
        // Reserva rápida desde el LIVE: RESERVAR_BUSINESSID_CODIGO
        if (buttonId.startsWith('RESERVAR_')) {
            const parts = buttonId.split('_');
            const businessId = parts[1];
            const productCode = parts[2];
            
            return await this.procesarReservaRapida(from, businessId, productCode);
        }
        
        // Botones del menú normal
        const titleLower = buttonTitle.toLowerCase();
        
        if (titleLower === 'ver carrito') {
            return await this.mostrarCarrito(from, session.businessId);
        }
        
        if (titleLower === 'pagar') {
            return await this.iniciarPago(from, session.businessId);
        }
        
        if (titleLower === 'seguir comprando') {
            return await this.mostrarMenuNegocio(from, session.businessId);
        }
        
        if (titleLower === 'cambiar negocio') {
            stateManager.setStep(from, 'seleccionar_negocio');
            return await this.mostrarListaNegocios(from);
        }
        
        if (titleLower === 'vaciar carrito') {
            stateManager.clearCart(from, session.businessId);
            return await whatsappService.sendMessage(from,
                `🗑️ Carrito vaciado.\n\nEscribe un codigo de producto para comenzar.`
            );
        }
        
        if (titleLower === 'si, confirmar') {
            const cliente = session.data?.cliente;
            if (cliente) {
                return await this.crearPedido(from, session.businessId, cliente);
            }
        }
        
        if (titleLower === 'editar datos') {
            stateManager.setStep(from, 'datos_nombre');
            return await whatsappService.sendMessage(from,
                `📝 Vamos a actualizar tus datos.\n\n¿Cual es tu *nombre completo*?`
            );
        }
        
        if (titleLower.includes('live 5')) {
            return await this.suscribirAlLive(from, 5);
        }
        
        if (titleLower.includes('live 10')) {
            return await this.suscribirAlLive(from, 10);
        }
        
        // Selección de negocio por nombre
        const negocios = sheetsService.getBusinesses();
        const negocioMatch = negocios.find(n => 
            n.nombre.toLowerCase() === titleLower
        );
        if (negocioMatch) {
            stateManager.setActiveBusiness(from, negocioMatch.id);
            return await this.mostrarMenuNegocio(from, negocioMatch.id);
        }
        
        return await whatsappService.sendMessage(from, 
            `No entendi esa opcion. Escribe *"inicio"* para ver el menu.`
        );
    }
    
    async procesarReservaRapida(from, businessId, productCode) {
        const cliente = await sheetsService.findClient(businessId, from);
        const nombreUsuario = cliente?.nombre || 'Usuario';
        
        // Intentar reservar (primero en llegar gana)
        const resultado = liveManager.tryReserve(businessId, productCode, from, nombreUsuario);
        
        if (!resultado.success) {
            // Ya fue reservado por otro usuario
            return await whatsappService.sendMessage(from,
                `${resultado.message}\n\n` +
                `Sigue atento al LIVE, vienen mas productos! 👀`
            );
        }
        
        // ¡RESERVADO! Ahora reservar el stock real
        const stockResult = await sheetsService.reserveStock(businessId, productCode, 1);
        
        if (!stockResult.success) {
            // Error de stock, liberar la reserva del live
            liveManager.clearLiveProduct(businessId, productCode);
            return await whatsappService.sendMessage(from,
                `❌ El producto ya no tiene stock disponible.\n\n` +
                `Sigue atento al LIVE! 👀`
            );
        }
        
        // Agregar al carrito
        stateManager.setActiveBusiness(from, businessId);
        stateManager.addToCart(from, businessId, {
            codigo: resultado.producto.codigo,
            nombre: resultado.producto.nombre,
            cantidad: 1,
            precio: resultado.producto.precio
        });
        
        const cart = stateManager.getCart(from, businessId);
        const cartTotal = stateManager.getCartTotal(from, businessId);
        
        let mensaje = `🎉 *¡LO APARTASTE!*\n\n`;
        mensaje += `✅ ${resultado.producto.nombre}\n`;
        mensaje += `💰 S/${resultado.producto.precio.toFixed(2)}\n\n`;
        mensaje += `🛒 Tu carrito: ${cart.length} producto(s)\n`;
        mensaje += `💵 Total: S/${cartTotal.toFixed(2)}\n\n`;
        mensaje += `Sigue en el LIVE o escribe *"pagar"* cuando termines.`;
        
        return await whatsappService.sendButtonMessage(from, mensaje, [
            { title: 'Pagar ahora' },
            { title: 'Seguir en el LIVE' }
        ]);
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
            return await this.mostrarMenuNegocioConLive(from, negocio.id);
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
        
        return await this.mostrarMenuNegocioConLive(from, negocioSeleccionado.id);
    }
    
    // MENU DEL NEGOCIO CON OPCION LIVE
    
    async mostrarMenuNegocioConLive(from, businessId) {
        const negocio = sheetsService.getBusiness(businessId);
        if (!negocio) {
            return await this.mostrarBienvenida(from);
        }
        
        const cart = stateManager.getCart(from, businessId);
        const cartTotal = stateManager.getCartTotal(from, businessId);
        const isSubscribed = liveManager.isSubscribed(businessId, from);
        const subscriberCount = liveManager.getSubscriberCount(businessId);
        
        let mensaje = `🏪 *${negocio.nombre}*\n\n`;
        
        if (isSubscribed) {
            mensaje += `🔴 *Estas conectado al LIVE*\n`;
            mensaje += `👥 ${subscriberCount} personas conectadas\n\n`;
        }
        
        if (cart.length > 0) {
            mensaje += `🛒 Tienes *${cart.length} producto(s)* en tu carrito\n`;
            mensaje += `💰 Total: *S/${cartTotal.toFixed(2)}*\n\n`;
        }
        
        mensaje += `📺 *¿Hay un LIVE activo?*\n`;
        mensaje += `Suscribete para recibir productos en tiempo real!\n\n`;
        mensaje += `⏱️ Elige cuanto tiempo quieres estar conectado:`;
        
        stateManager.setStep(from, 'menu_negocio');
        
        const botones = [
            { title: '🔴 LIVE 5 min' },
            { title: '🔴 LIVE 10 min' }
        ];
        
        if (cart.length > 0) {
            botones.push({ title: 'Ver carrito' });
        }
        
        return await whatsappService.sendButtonMessage(from, mensaje, botones);
    }
    
    async mostrarMenuNegocio(from, businessId) {
        return await this.mostrarMenuNegocioConLive(from, businessId);
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
