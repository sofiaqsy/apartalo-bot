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
        console.log('MessageHandler inicializado con Live Commerce');
    }
    
    async handleMessage(from, body, mediaUrl = null, interactiveData = null) {
        const mensaje = body.trim();
        const mensajeLower = mensaje.toLowerCase();
        const session = stateManager.getSession(from);
        
        console.log('Mensaje de ' + from);
        console.log('Texto: ' + mensaje);
        console.log('Step: ' + session.step);
        console.log('Business: ' + (session.businessId || 'ninguno'));
        if (interactiveData) {
            console.log('Interactive: ' + JSON.stringify(interactiveData));
        }
        
        // MANEJAR BOTONES INTERACTIVOS (reserva rapida del LIVE)
        if (interactiveData && interactiveData.type === 'button_reply') {
            return await this.handleInteractive(from, interactiveData, session);
        }
        
        // Detectar si el mensaje es un ID de boton (empieza con RESERVAR_)
        if (mensaje.startsWith('RESERVAR_')) {
            const parts = mensaje.split('_');
            if (parts.length >= 3) {
                const businessId = parts[1];
                const productCode = parts[2];
                return await this.procesarReservaRapida(from, businessId, productCode);
            }
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
        if (mensajeLower === 'live 5' || mensajeLower === 'live5' || mensajeLower === 'live 5 min') {
            return await this.suscribirAlLive(from, 5);
        }
        
        if (mensajeLower === 'live 10' || mensajeLower === 'live10' || mensajeLower === 'live 10 min') {
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
                    'No hay negocios disponibles en este momento.'
                );
            }
        }
        
        const negocio = sheetsService.getBusiness(businessId);
        const cliente = await sheetsService.findClient(businessId, from);
        const nombreUsuario = cliente?.nombre || 'Usuario';
        
        liveManager.subscribe(businessId, from, nombreUsuario, minutos);
        
        let mensaje = '🔴 ESTAS EN EL LIVE\n\n';
        mensaje += negocio.nombre + '\n';
        mensaje += 'Duracion: ' + minutos + ' minutos\n\n';
        mensaje += '✨ Recibiras los productos en tiempo real\n';
        mensaje += '⚡ El primero en tocar "ApartaLo" se lo lleva\n\n';
        mensaje += 'Escribe "salir" para desconectarte';
        
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
            'Saliste del LIVE.\n\n' +
            'Puedes seguir comprando escribiendo codigos de productos, ' +
            'o escribir "live 5" o "live 10" para volver a conectarte.'
        );
    }
    
    // ========================================
    // LIVE COMMERCE - BOTONES INTERACTIVOS
    // ========================================
    
    async handleInteractive(from, interactiveData, session) {
        // El ID viene directamente en interactiveData.id
        const buttonId = interactiveData.id || '';
        const buttonTitle = interactiveData.title || '';
        
        console.log('Boton presionado ID: ' + buttonId + ' Title: ' + buttonTitle);
        
        // Reserva rapida desde el LIVE: RESERVAR_BUSINESSID_CODIGO
        if (buttonId.startsWith('RESERVAR_')) {
            const parts = buttonId.split('_');
            if (parts.length >= 3) {
                const businessId = parts[1];
                const productCode = parts[2];
                return await this.procesarReservaRapida(from, businessId, productCode);
            }
        }
        
        // Botones del menu normal (usar titulo)
        const titleLower = buttonTitle.toLowerCase();
        
        if (titleLower === 'ver carrito' || titleLower === 'carrito' || titleLower === 'ver pedido') {
            // Ver el pedido activo
            const pedidoId = stateManager.getActivePedido(from);
            if (pedidoId && session.businessId) {
                const pedido = await sheetsService.getOrderById(session.businessId, pedidoId);
                if (pedido) {
                    return await this.mostrarDetallePedido(from, session.businessId, pedido);
                }
            }
            return await this.mostrarCarrito(from, session.businessId);
        }
        
        if (titleLower === 'pagar' || titleLower === 'pagar ahora') {
            return await this.iniciarPago(from, session.businessId);
        }
        
        if (titleLower === 'seguir comprando' || titleLower === 'seguir en el live') {
            return await this.mostrarMenuNegocio(from, session.businessId);
        }
        
        if (titleLower === 'cambiar negocio') {
            stateManager.setStep(from, 'seleccionar_negocio');
            return await this.mostrarListaNegocios(from);
        }
        
        if (titleLower === 'vaciar carrito') {
            stateManager.clearCart(from, session.businessId);
            return await whatsappService.sendMessage(from,
                'Carrito vaciado.\n\nEscribe un codigo de producto para comenzar.'
            );
        }
        
        if (titleLower === 'enviar comprobante' || titleLower === 'enviar voucher') {
            return await whatsappService.sendMessage(from,
                '📸 Perfecto!\n\nEnvia la foto o captura de tu comprobante de pago.'
            );
        }
        
        if (titleLower === 'si, confirmar' || titleLower === 'confirmar') {
            const cliente = session.data?.cliente;
            if (cliente) {
                return await this.crearPedido(from, session.businessId, cliente);
            }
        }
        
        if (titleLower === 'editar datos') {
            stateManager.setStep(from, 'datos_nombre');
            return await whatsappService.sendMessage(from,
                'Vamos a actualizar tus datos.\n\nCual es tu nombre completo?'
            );
        }
        
        if (titleLower.includes('live 5')) {
            return await this.suscribirAlLive(from, 5);
        }
        
        if (titleLower.includes('live 10')) {
            return await this.suscribirAlLive(from, 10);
        }
        
        // Seleccion de negocio por nombre
        const negocios = sheetsService.getBusinesses();
        const negocioMatch = negocios.find(n => 
            n.nombre.toLowerCase() === titleLower
        );
        if (negocioMatch) {
            stateManager.setActiveBusiness(from, negocioMatch.id);
            return await this.mostrarMenuNegocio(from, negocioMatch.id);
        }
        
        return await whatsappService.sendMessage(from, 
            'No entendi esa opcion. Escribe "inicio" para ver el menu.'
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
                resultado.message + '\n\n' +
                'Sigue atento al LIVE, vienen mas productos!'
            );
        }
        
        // RESERVADO! Ahora reservar el stock real
        const stockResult = await sheetsService.reserveStock(businessId, productCode, 1);
        
        if (!stockResult.success) {
            // Error de stock, liberar la reserva del live
            liveManager.clearLiveProduct(businessId, productCode);
            return await whatsappService.sendMessage(from,
                'El producto ya no tiene stock disponible.\n\n' +
                'Sigue atento al LIVE!'
            );
        }
        
        // Limpiar producto del live
        liveManager.clearLiveProduct(businessId, productCode);
        
        // Verificar si ya tiene un pedido activo
        let pedidoId = stateManager.getActivePedido(from);
        let esNuevoPedido = false;
        
        if (!pedidoId) {
            // CREAR NUEVO PEDIDO con el primer producto
            esNuevoPedido = true;
            const pedidoData = {
                whatsapp: from,
                cliente: cliente?.nombre || nombreUsuario,
                telefono: cliente?.telefono || '',
                direccion: cliente?.direccion || '',
                items: [{
                    codigo: resultado.producto.codigo,
                    nombre: resultado.producto.nombre,
                    cantidad: 1,
                    precio: resultado.producto.precio,
                    subtotal: resultado.producto.precio
                }],
                total: resultado.producto.precio
            };
            
            const pedidoResult = await sheetsService.createOrder(businessId, pedidoData);
            
            if (!pedidoResult.success) {
                // Si falla crear pedido, liberar stock
                await sheetsService.releaseStock(businessId, productCode, 1);
                return await whatsappService.sendMessage(from,
                    '❌ Error al procesar tu reserva. Intenta nuevamente.'
                );
            }
            
            pedidoId = pedidoResult.pedidoId;
            stateManager.setActivePedido(from, businessId, pedidoId);
            
        } else {
            // AGREGAR PRODUCTO al pedido existente
            const addResult = await sheetsService.addProductToOrder(businessId, pedidoId, {
                codigo: resultado.producto.codigo,
                nombre: resultado.producto.nombre,
                cantidad: 1,
                precio: resultado.producto.precio
            });
            
            if (!addResult.success) {
                // Si falla agregar, liberar stock
                await sheetsService.releaseStock(businessId, productCode, 1);
                return await whatsappService.sendMessage(from,
                    '❌ Error al agregar el producto. Intenta nuevamente.'
                );
            }
        }
        
        // Obtener pedido actualizado
        const pedido = await sheetsService.getOrderById(businessId, pedidoId);
        const numProductos = pedido.productos.split('|').length;
        
        let mensaje = '✅ ¡LO APARTASTE!\n\n';
        mensaje += resultado.producto.nombre + '\n';
        mensaje += 'S/' + resultado.producto.precio.toFixed(2) + '\n\n';
        
        if (esNuevoPedido) {
            mensaje += '📦 Pedido creado: ' + pedidoId + '\n';
        } else {
            mensaje += '📦 Agregado al pedido: ' + pedidoId + '\n';
        }
        
        mensaje += '🛒 Productos en tu pedido: ' + numProductos + '\n';
        mensaje += 'Total: S/' + pedido.total.toFixed(2) + '\n\n';
        mensaje += '⏰ Tienes 30 minutos para pagar\n\n';
        mensaje += '¿Que deseas hacer?';
        
        stateManager.setStep(from, 'esperando_codigo');
        
        return await whatsappService.sendButtonMessage(from, mensaje, [
            { title: 'Seguir en LIVE', id: 'seguir' },
            { title: 'Pagar ahora', id: 'pagar' },
            { title: 'Ver pedido', id: 'ver_pedido' }
        ]);
    }
    
    // BIENVENIDA Y SELECCION DE NEGOCIO
    
    async mostrarBienvenida(from) {
        const negocios = sheetsService.getBusinesses();
        
        if (negocios.length === 0) {
            return await whatsappService.sendMessage(from,
                'Hola! Bienvenido a ' + config.platform.name + '\n\n' +
                'En este momento no hay negocios disponibles.\n' +
                'Por favor, intenta mas tarde.'
            );
        }
        
        // Si hay un solo negocio, mostrarlo directamente
        if (negocios.length === 1) {
            const negocio = negocios[0];
            stateManager.setActiveBusiness(from, negocio.id);
            stateManager.subscribe(from, negocio.id);
            
            // Mostrar pedidos pendientes si los hay
            await this.mostrarPedidosPendientes(from, negocio.id);
            
            return await this.mostrarMenuNegocioConLive(from, negocio.id);
        }
        
        stateManager.setStep(from, 'seleccionar_negocio');
        return await this.mostrarListaNegocios(from);
    }
    
    async mostrarListaNegocios(from) {
        const negocios = sheetsService.getBusinesses();
        
        let mensaje = config.platform.name + '\n\n';
        mensaje += 'Con que negocio quieres comprar hoy?\n\n';
        
        negocios.forEach((neg, idx) => {
            mensaje += (idx + 1) + '. ' + neg.nombre + '\n';
            if (neg.descripcion) {
                mensaje += '   ' + neg.descripcion + '\n';
            }
        });
        
        mensaje += '\nEscribe el numero del negocio';
        
        if (negocios.length <= 3) {
            const botones = negocios.map(neg => ({ 
                title: neg.nombre.substring(0, 20),
                id: 'negocio_' + neg.id
            }));
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
                'No encontre ese negocio.\n\n' +
                'Escribe el numero del negocio o su nombre.'
            );
        }
        
        stateManager.setActiveBusiness(from, negocioSeleccionado.id);
        stateManager.subscribe(from, negocioSeleccionado.id);
        
        // Mostrar pedidos pendientes si los hay
        await this.mostrarPedidosPendientes(from, negocioSeleccionado.id);
        
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
        
        let mensaje = negocio.nombre + '\n\n';
        
        if (isSubscribed) {
            mensaje += 'Estas conectado al LIVE\n';
            mensaje += subscriberCount + ' personas conectadas\n\n';
        }
        
        if (cart.length > 0) {
            mensaje += 'Tienes ' + cart.length + ' producto(s) en tu carrito\n';
            mensaje += 'Total: S/' + cartTotal.toFixed(2) + '\n\n';
        }
        
        mensaje += 'Hay un LIVE activo?\n';
        mensaje += 'Suscribete para recibir productos en tiempo real!\n\n';
        mensaje += 'Elige cuanto tiempo quieres estar conectado:';
        
        stateManager.setStep(from, 'menu_negocio');
        
        const botones = [
            { title: 'LIVE 5 min', id: 'live5' },
            { title: 'LIVE 10 min', id: 'live10' }
        ];
        
        if (cart.length > 0) {
            botones.push({ title: 'Ver carrito', id: 'carrito' });
        }
        
        return await whatsappService.sendButtonMessage(from, mensaje, botones);
    }
    
    async mostrarMenuNegocio(from, businessId) {
        return await this.mostrarMenuNegocioConLive(from, businessId);
    }
    
    // MOSTRAR PEDIDOS PENDIENTES
    
    async mostrarPedidosPendientes(from, businessId) {
        try {
            const pedidos = await sheetsService.getOrdersByClient(businessId, from);
            
            // Filtrar solo pedidos activos (no entregados ni cancelados)
            const pedidosActivos = pedidos.filter(p => 
                p.estado !== 'ENTREGADO' && p.estado !== 'CANCELADO'
            );
            
            if (pedidosActivos.length === 0) return;
            
            let mensaje = '📦 TUS PEDIDOS ACTIVOS:\n\n';
            
            pedidosActivos.forEach((pedido, idx) => {
                mensaje += `${idx + 1}. ${pedido.id}\n`;
                mensaje += `   Estado: ${this.formatearEstado(pedido.estado)}\n`;
                mensaje += `   Total: S/${pedido.total.toFixed(2)}\n`;
                mensaje += `   Fecha: ${pedido.fecha}\n\n`;
            });
            
            mensaje += 'Escribe el codigo del pedido para ver detalles.';
            
            // Si hay pedidos pendientes de pago, agregar botón
            const pedidosPendientesPago = pedidosActivos.filter(p => p.estado === 'PENDIENTE_PAGO');
            
            if (pedidosPendientesPago.length > 0) {
                // Si hay solo un pedido pendiente, botón directo
                if (pedidosPendientesPago.length === 1) {
                    const pedido = pedidosPendientesPago[0];
                    stateManager.setStep(from, 'esperando_voucher', { pedidoId: pedido.id });
                    
                    return await whatsappService.sendButtonMessage(from, mensaje, [
                        { title: 'Enviar comprobante', id: 'enviar_voucher' }
                    ]);
                } else {
                    // Si hay múltiples, pedir que escriba el código
                    return await whatsappService.sendMessage(from, mensaje);
                }
            } else {
                await whatsappService.sendMessage(from, mensaje);
            }
        } catch (error) {
            console.error('Error mostrando pedidos:', error);
        }
    }
    
    formatearEstado(estado) {
        const estados = {
            'PENDIENTE_PAGO': '⏳ Pendiente de pago',
            'PENDIENTE_VALIDACION': '🔍 Validando voucher',
            'CONFIRMADO': '✅ Confirmado',
            'EN_PREPARACION': '📦 En preparacion',
            'ENVIADO': '🚚 Enviado',
            'ENTREGADO': '✅ Entregado',
            'CANCELADO': '❌ Cancelado'
        };
        return estados[estado] || estado;
    }
    
    async mostrarDetallePedido(from, businessId, pedido) {
        const negocio = sheetsService.getBusiness(businessId);
        
        let mensaje = '📦 DETALLE DEL PEDIDO\n\n';
        mensaje += 'Codigo: ' + pedido.id + '\n';
        mensaje += 'Estado: ' + this.formatearEstado(pedido.estado) + '\n';
        mensaje += 'Fecha: ' + pedido.fecha + ' ' + pedido.hora + '\n\n';
        
        mensaje += 'Productos:\n';
        const items = pedido.productos.split('|');
        items.forEach(item => {
            const [codigo, nombre, cantidad, precio] = item.split(':');
            mensaje += '- ' + cantidad + 'x ' + nombre + ' - S/' + (parseFloat(cantidad) * parseFloat(precio)).toFixed(2) + '\n';
        });
        
        mensaje += '\nTotal: S/' + pedido.total.toFixed(2) + '\n\n';
        
        if (pedido.direccion) {
            mensaje += 'Entrega en:\n' + pedido.direccion + '\n\n';
        }
        
        if (pedido.estado === 'PENDIENTE_PAGO') {
            mensaje += '💳 CUENTAS PARA PAGAR:\n\n';
            
            // Mostrar cuentas bancarias del negocio
            if (negocio.cuentasBancarias) {
                const cuentas = negocio.cuentasBancarias.split('|');
                cuentas.forEach(cuenta => {
                    const [banco, numero] = cuenta.split(':');
                    mensaje += '🏦 ' + banco + '\n';
                    mensaje += '   ' + numero + '\n\n';
                });
            } else {
                mensaje += 'Contacta al vendedor para datos de pago\n\n';
            }
            
            mensaje += '⏰ Tienes 30 minutos para completar el pago';
            
            stateManager.setStep(from, 'esperando_voucher', { pedidoId: pedido.id });
            
            // Botón para enviar comprobante
            return await whatsappService.sendButtonMessage(from, mensaje, [
                { title: 'Enviar comprobante', id: 'enviar_voucher' }
            ]);
            
        } else if (pedido.estado === 'PENDIENTE_VALIDACION') {
            mensaje += '⏳ Tu voucher esta siendo validado. Te notificaremos pronto.';
        } else {
            mensaje += 'Gracias por tu compra! 🎉';
        }
        
        return await whatsappService.sendMessage(from, mensaje);
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
        
        // Verificar si es un codigo de pedido (formato: PREFIJO-123456)
        if (codigo.includes('-')) {
            const pedido = await sheetsService.getOrderById(businessId, codigo);
            if (pedido) {
                return await this.mostrarDetallePedido(from, businessId, pedido);
            }
        }
        
        // Si no es pedido, buscar producto
        const producto = await sheetsService.getProductByCode(businessId, codigo);
        
        if (!producto) {
            return await whatsappService.sendMessage(from,
                'Codigo ' + codigo + ' no encontrado.\n\n' +
                'Verifica el codigo del producto del live y escribelo nuevamente.'
            );
        }
        
        let mensaje_producto = producto.nombre + '\n\n';
        mensaje_producto += (producto.descripcion || 'Sin descripcion') + '\n';
        mensaje_producto += 'Precio: S/' + producto.precio.toFixed(2) + '\n';
        mensaje_producto += 'Disponible: ' + producto.disponible + ' unidades\n\n';
        mensaje_producto += 'Cuantas unidades quieres reservar?';
        
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
                'Por favor, ingresa un numero valido.\n\n' +
                'Cuantas unidades de ' + producto.nombre + ' quieres?'
            );
        }
        
        if (cantidad > producto.disponible) {
            return await whatsappService.sendMessage(from,
                'Solo hay ' + producto.disponible + ' unidades disponibles.\n\n' +
                'Cuantas quieres reservar?'
            );
        }
        
        const resultado = await sheetsService.reserveStock(session.businessId, producto.codigo, cantidad);
        
        if (!resultado.success) {
            return await whatsappService.sendMessage(from,
                resultado.error + '\n\n' +
                'Intenta con otra cantidad o escribe otro codigo.'
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
        
        let respuesta = 'Reservado!\n\n';
        respuesta += cantidad + 'x ' + producto.nombre + '\n';
        respuesta += 'Subtotal: S/' + (cantidad * producto.precio).toFixed(2) + '\n\n';
        respuesta += 'Tu carrito (' + cart.length + ' productos)\n';
        respuesta += 'Total: S/' + cartTotal.toFixed(2) + '\n\n';
        respuesta += 'Que deseas hacer?';
        
        stateManager.setStep(from, 'esperando_codigo');
        
        return await whatsappService.sendButtonMessage(from, respuesta, [
            { title: 'Seguir comprando', id: 'seguir' },
            { title: 'Pagar', id: 'pagar' },
            { title: 'Ver carrito', id: 'carrito' }
        ]);
    }
    
    // CARRITO
    
    async mostrarCarrito(from, businessId) {
        const cart = stateManager.getCart(from, businessId);
        const negocio = sheetsService.getBusiness(businessId);
        
        if (cart.length === 0) {
            return await whatsappService.sendMessage(from,
                'Tu carrito esta vacio.\n\n' +
                'Escribe el codigo de un producto del live para agregarlo.'
            );
        }
        
        let mensaje = 'Tu carrito en ' + negocio.nombre + '\n\n';
        
        cart.forEach((item, idx) => {
            mensaje += (idx + 1) + '. ' + item.nombre + '\n';
            mensaje += '   ' + item.cantidad + ' x S/' + item.precio.toFixed(2) + ' = S/' + item.subtotal.toFixed(2) + '\n\n';
        });
        
        const total = stateManager.getCartTotal(from, businessId);
        mensaje += '-------------------\n';
        mensaje += 'TOTAL: S/' + total.toFixed(2) + '\n\n';
        mensaje += 'Escribe otro codigo para agregar mas productos';
        
        stateManager.setStep(from, 'esperando_codigo');
        
        return await whatsappService.sendButtonMessage(from, mensaje, [
            { title: 'Pagar', id: 'pagar' },
            { title: 'Seguir comprando', id: 'seguir' },
            { title: 'Vaciar carrito', id: 'vaciar' }
        ]);
    }
    
    // PROCESO DE PAGO
    
    async iniciarPago(from, businessId) {
        const cart = stateManager.getCart(from, businessId);
        
        if (cart.length === 0) {
            return await whatsappService.sendMessage(from,
                'Tu carrito esta vacio.\n\n' +
                'Escribe el codigo de un producto para agregarlo.'
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
            'Datos para tu pedido\n\n' +
            'Paso 1 de 3\n\n' +
            'Cual es tu nombre completo?'
        );
    }
    
    async confirmarDatosCliente(from, businessId, cliente) {
        const cart = stateManager.getCart(from, businessId);
        const total = stateManager.getCartTotal(from, businessId);
        
        let mensaje = 'Confirma tu pedido\n\n';
        
        mensaje += 'Productos:\n';
        cart.forEach(item => {
            mensaje += '- ' + item.cantidad + 'x ' + item.nombre + ' - S/' + item.subtotal.toFixed(2) + '\n';
        });
        mensaje += '\nTotal: S/' + total.toFixed(2) + '\n\n';
        
        mensaje += 'Datos de entrega:\n';
        mensaje += cliente.nombre + '\n';
        mensaje += cliente.direccion + '\n';
        mensaje += (cliente.telefono || 'No registrado') + '\n\n';
        
        mensaje += 'Los datos son correctos?';
        
        stateManager.setStep(from, 'confirmar_pedido', { cliente });
        
        return await whatsappService.sendButtonMessage(from, mensaje, [
            { title: 'Si, confirmar', id: 'confirmar' },
            { title: 'Editar datos', id: 'editar' },
            { title: 'Cancelar', id: 'cancelar' }
        ]);
    }
    
    async procesarDatosNombre(from, mensaje) {
        const nombre = mensaje.trim();
        
        if (nombre.length < 2) {
            return await whatsappService.sendMessage(from,
                'Por favor, ingresa tu nombre completo.'
            );
        }
        
        stateManager.setStep(from, 'datos_direccion', { nombre });
        
        return await whatsappService.sendMessage(from,
            'Nombre: ' + nombre + '\n\n' +
            'Paso 2 de 3\n\n' +
            'Cual es tu direccion completa de entrega?\n' +
            'Incluye distrito y referencia'
        );
    }
    
    async procesarDatosDireccion(from, mensaje) {
        const direccion = mensaje.trim();
        
        if (direccion.length < 10) {
            return await whatsappService.sendMessage(from,
                'Por favor, ingresa una direccion mas completa.\n' +
                'Incluye calle, numero, distrito y referencia.'
            );
        }
        
        stateManager.setStep(from, 'datos_telefono', { direccion });
        
        return await whatsappService.sendMessage(from,
            'Direccion: ' + direccion + '\n\n' +
            'Paso 3 de 3\n\n' +
            'Cual es tu numero de telefono de contacto?'
        );
    }
    
    async procesarDatosTelefono(from, mensaje) {
        const session = stateManager.getSession(from);
        const telefono = mensaje.replace(/[^0-9]/g, '');
        
        if (telefono.length < 7) {
            return await whatsappService.sendMessage(from,
                'Por favor, ingresa un numero de telefono valido.'
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
                'Error creando el pedido. Por favor, intenta nuevamente.'
            );
        }
        
        stateManager.clearCart(from, businessId);
        
        let mensaje = 'Pedido creado!\n\n';
        mensaje += 'Codigo: ' + resultado.pedidoId + '\n\n';
        mensaje += 'Productos:\n';
        cart.forEach(item => {
            mensaje += '- ' + item.cantidad + 'x ' + item.nombre + '\n';
        });
        mensaje += '\nTotal: S/' + total.toFixed(2) + '\n\n';
        mensaje += 'Entrega en:\n' + cliente.direccion + '\n\n';
        mensaje += 'Para confirmar tu pedido:\n';
        mensaje += 'Envia el voucher de tu pago a este chat.\n\n';
        mensaje += 'Tienes 30 minutos para completar el pago.';
        
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
                'Por favor, envia una imagen de tu voucher de pago.\n\n' +
                'Tu codigo de pedido es: ' + pedidoId
            );
        }
        
        // Descargar imagen de WhatsApp
        await whatsappService.sendMessage(from, '⏳ Procesando tu comprobante...');
        
        const downloadResult = await whatsappService.downloadMedia(mediaUrl);
        
        if (!downloadResult.success) {
            return await whatsappService.sendMessage(from,
                '❌ Error al descargar la imagen. Por favor, intenta nuevamente.'
            );
        }
        
        // Subir a Google Drive
        const filename = `voucher_${pedidoId}_${Date.now()}.jpg`;
        const uploadResult = await sheetsService.uploadImageToDrive(
            downloadResult.buffer,
            filename,
            downloadResult.mimeType
        );
        
        if (!uploadResult.success) {
            return await whatsappService.sendMessage(from,
                '❌ Error al guardar el comprobante. Por favor, intenta nuevamente.'
            );
        }
        
        // Actualizar pedido con el link de Drive
        await sheetsService.updateOrderStatus(
            session.businessId, 
            pedidoId, 
            'PENDIENTE_VALIDACION',
            uploadResult.directLink
        );
        
        // Limpiar el pedido activo ya que se envió el voucher
        stateManager.clearActivePedido(from);
        
        stateManager.setStep(from, 'esperando_codigo');
        
        return await whatsappService.sendMessage(from,
            '✅ Voucher recibido!\n\n' +
            'Tu pedido ' + pedidoId + ' esta siendo verificado.\n\n' +
            'Te notificaremos cuando sea confirmado.\n\n' +
            'Gracias por tu compra!'
        );
    }
}

module.exports = new MessageHandler();
