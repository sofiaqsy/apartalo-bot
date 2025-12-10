/**
 * Message Handler - Router Principal
 * Maneja el flujo de conversacion multi-negocio con Live Commerce
 */

const stateManager = require('./state-manager');
const sheetsService = require('./sheets-service');
const whatsappService = require('./whatsapp-service');
const liveManager = require('./live-manager');
const config = require('./config');
const { construirLinkWhatsAppConsulta } = require('./utils/whatsapp-utils');

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

        // Detectar mensaje de APARTADO desde catálogo web
        if (mensaje.startsWith('APARTADO_WEB')) {
            return await this.procesarApartadoWeb(from, mensaje);
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
                // Si hay mediaUrl (imagen), procesarla como voucher
                if (mediaUrl) {
                    return await this.procesarVoucher(from, mensaje, mediaUrl);
                }
                // Si no hay imagen, informar que se necesita
                return await whatsappService.sendMessage(from,
                    '📸 Por favor, envía la imagen de tu comprobante de pago.\n\n' +
                    'Código de pedido: ' + (session.data?.pedidoId || 'N/A')
                );

            // Flujo de envío post-pago
            case 'preguntar_ciudad':
                return await this.procesarCiudad(from, mensaje);

            case 'seleccionar_sede':
                // Si el mensaje es numérico, procesar selección
                if (/^\d+$/.test(mensaje)) {
                    return await this.procesarSeleccionSede(from, mensaje);
                }
                // Si no, sugerir usar botones o número
                return await whatsappService.sendMessage(from,
                    'Por favor, selecciona una sede válida de la lista respondiendo con el número.'
                );

            case 'seleccionar_envio':
                // Se maneja en handleInteractive, pero si escribe texto
                const msgLower1 = mensaje.toLowerCase();
                if (msgLower1.includes('local') || msgLower1.includes('delivery')) {
                    return await this.procesarSeleccionEnvio(from, 'envio_local');
                } else if (msgLower1.includes('recojo') || msgLower1.includes('tienda')) {
                    return await this.procesarSeleccionEnvio(from, 'recojo_tienda');
                } else if (msgLower1.includes('courier') || msgLower1.includes('nacional')) {
                    return await this.procesarSeleccionEnvio(from, 'envio_nacional');
                }
                return await whatsappService.sendMessage(from,
                    'Por favor, selecciona una opción usando los botones.'
                );

            case 'seleccionar_empresa':
                // Si escribe el nombre de la empresa
                return await this.procesarSeleccionEmpresa(from, `empresa_${mensaje.toLowerCase()}`);

            case 'seleccionar_sede':
                // Si escribe el número o nombre de la sede
                return await this.procesarSeleccionSede(from, mensaje);

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

    // Live methods removed


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

        if (buttonId.startsWith('ver_pedido_')) {
            const pedidoId = buttonId.replace('ver_pedido_', '');
            const pedido = await sheetsService.getOrderById(session.businessId, pedidoId);
            if (pedido) {
                return await this.mostrarDetallePedido(from, session.businessId, pedido);
            }
        }

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

        if (buttonId.startsWith('enviar_voucher_')) {
            const pedidoId = buttonId.replace('enviar_voucher_', '');
            stateManager.setStep(from, 'esperando_voucher', { pedidoId });
            return await whatsappService.sendMessage(from,
                '📸 Perfecto!\n\nEnvia la foto o captura de tu comprobante de pago para el pedido ' + pedidoId
            );
        }

        if (titleLower === 'enviar comprobante' || titleLower === 'enviar voucher') {
            // Fallback for generic button
            const pedidoId = stateManager.getActivePedido(from);
            if (!pedidoId && session.businessId) {
                const pedidos = await sheetsService.getOrdersByClient(session.businessId, from);
                const pedidoPendiente = pedidos.find(p => p.estado === 'PENDIENTE_PAGO');
                if (pedidoPendiente) {
                    stateManager.setStep(from, 'esperando_voucher', { pedidoId: pedidoPendiente.id });
                }
            } else if (pedidoId) {
                stateManager.setStep(from, 'esperando_voucher', { pedidoId });
            }

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
            // Preservar datos del producto apartado si existe
            const sessionData = session.data || {};
            stateManager.setStep(from, 'datos_nombre', {
                ...sessionData,
                fromWeb: sessionData.fromWeb || false
            });
            return await whatsappService.sendMessage(from,
                'Vamos a actualizar tus datos.\n\n' +
                'Paso 1 de 3\n' +
                '¿Cuál es tu nombre completo?'
            );
        }

        if (buttonId === 'ver_pedidos' || titleLower === 'ver mis pedidos') {
            return await this.mostrarPedidosPendientes(from, session.businessId);
        }


        // ========================================
        // BOTONES DE FLUJO DE ENVÍO
        // ========================================

        // Opciones de tipo de envío
        if (buttonId === 'envio_local' || buttonId === 'recojo_tienda' || buttonId === 'envio_nacional') {
            return await this.procesarSeleccionEnvio(from, buttonId);
        }

        // Selección de empresa de courier
        if (buttonId.startsWith('empresa_')) {
            return await this.procesarSeleccionEmpresa(from, buttonId);
        }

        // Selección de sede
        if (buttonId.startsWith('sede_')) {
            return await this.procesarSeleccionSede(from, buttonId);
        }

        // Confirmar datos de envío guardados
        if (buttonId === 'confirmar_envio_si') {
            return await this.confirmarEnvioGuardado(from);
        }

        if (buttonId === 'confirmar_envio_no') {
            return await this.cambiarDatosEnvio(from);
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
            'No entendí esa opción. Escribe "inicio" para ver el menú.'
        );
    }

    // procesarReservaRapida removed


    // ========================================
    // APARTADO DESDE CATÁLOGO WEB
    // El primero que envía el mensaje gana
    // ========================================

    async procesarApartadoWeb(from, mensaje) {
        console.log('Procesando apartado web:', mensaje);

        // Parsear datos del mensaje
        const lines = mensaje.split('\n');
        const datos = {};

        lines.forEach(line => {
            const match = line.match(/^([^:]+):\s*(.+)$/);
            if (match) {
                const key = match[1].trim().toLowerCase().replace(/\s+/g, '');
                const value = match[2].trim();
                datos[key] = value;
            }
        });

        const businessId = datos['negocioid'] || datos['businessid'] || datos['negocio'];
        const productId = datos['producto'] || datos['productid'];
        const productoNombre = datos['nombre'];
        const precioStr = datos['precio'] || '0';
        const precio = parseFloat(precioStr.replace(/[^0-9.]/g, ''));

        console.log('Datos parseados:', { businessId, productId, productoNombre, precio });

        if (!businessId || !productId) {
            return await whatsappService.sendMessage(from,
                '¡Hola! Bienvenido a ApartaLo.\n\n' +
                'Parece que hubo un problema con tu solicitud.\n' +
                'Por favor, vuelve al catálogo e intenta nuevamente.'
            );
        }

        // Configurar sesión con el negocio
        stateManager.setActiveBusiness(from, businessId);

        // Buscar el negocio
        const negocio = sheetsService.getBusiness(businessId);

        if (!negocio) {
            return await whatsappService.sendMessage(from,
                '¡Hola! Bienvenido a ApartaLo.\n\n' +
                'El negocio no está disponible en este momento.\n' +
                'Por favor, intenta más tarde.'
            );
        }

        // Verificar producto y stock
        const producto = await sheetsService.getProductByCode(businessId, productId);

        if (!producto) {
            return await whatsappService.sendMessage(from,
                '¡Hola! El producto que intentas apartar ya no está disponible.\n\n' +
                'Vuelve al catálogo para ver productos disponibles.'
            );
        }

        if (producto.disponible <= 0) {
            return await whatsappService.sendMessage(from,
                '¡Lo sentimos! Alguien más fue más rápido.\n\n' +
                '📦 ' + producto.nombre + '\n' +
                'Ya no tiene stock disponible.\n\n' +
                'Vuelve al catálogo para ver otros productos.'
            );
        }

        // ¡RESERVAR STOCK! El primero que llega gana
        const stockResult = await sheetsService.reserveStock(businessId, productId, 1);

        if (!stockResult.success) {
            return await whatsappService.sendMessage(from,
                '¡Lo sentimos! Alguien más fue más rápido.\n\n' +
                '📦 ' + producto.nombre + '\n' +
                'Ya fue apartado por otro cliente.\n\n' +
                'Vuelve al catálogo para ver otros productos.'
            );
        }

        // Notificar a viewers web que el stock cambió
        try {
            const catalogSocket = require('./catalog-socket');
            catalogSocket.notifyProductReserved(businessId, productId, stockResult.remainingStock || 0);
        } catch (e) {
            console.log('WebSocket notification skipped');
        }

        // Verificar si tenemos datos del cliente
        const cliente = await sheetsService.findClient(businessId, from);

        if (cliente && cliente.nombre && cliente.direccion) {
            // Ya tenemos datos del cliente - CREAR PEDIDO AHORA
            const pedidoData = {
                whatsapp: from,
                cliente: cliente.nombre,
                telefono: cliente.telefono || '',
                direccion: cliente.direccion,
                items: [{
                    codigo: productId,
                    nombre: producto.nombre,
                    cantidad: 1,
                    precio: producto.precio
                }],
                total: producto.precio,
                observaciones: 'Apartado desde catálogo web'
            };

            const pedidoResult = await sheetsService.createOrder(businessId, pedidoData);

            if (!pedidoResult.success) {
                await sheetsService.releaseStock(businessId, productId, 1);
                return await whatsappService.sendMessage(from,
                    '❌ Error al procesar tu pedido.\n\n' +
                    'Por favor, intenta nuevamente.'
                );
            }

            const pedidoId = pedidoResult.pedidoId;
            stateManager.setActivePedido(from, businessId, pedidoId);

            // Obtener configuración del negocio para métodos de pago
            const config = await sheetsService.getBusinessConfig(businessId);

            // Construir mensaje de éxito
            let mensajeRespuesta = '¡LO APARTASTE!\n\n';
            mensajeRespuesta += negocio.nombre + '\n\n';
            mensajeRespuesta += producto.nombre + '\n';
            mensajeRespuesta += 'S/' + producto.precio.toFixed(2) + '\n';
            mensajeRespuesta += 'Pedido: ' + pedidoId + '\n\n';
            mensajeRespuesta += 'Datos de entrega:\n';
            mensajeRespuesta += cliente.nombre + '\n';
            mensajeRespuesta += cliente.direccion + '\n\n';

            // Métodos de pago desde configuración del negocio
            if (config) {
                const textoMetodosPago = sheetsService.construirTextoMetodosPago(config);
                if (textoMetodosPago) {
                    mensajeRespuesta += textoMetodosPago + '\n\n';
                }
            } else if (negocio.cuentasBancarias) {
                // Fallback al campo legacy si no hay config
                mensajeRespuesta += 'CUENTAS PARA PAGAR:\n\n';
                const cuentas = negocio.cuentasBancarias.split('|');
                cuentas.forEach(cuenta => {
                    const [banco, numero] = cuenta.split(':');
                    if (banco && numero) {
                        mensajeRespuesta += banco + '\n';
                        mensajeRespuesta += numero + '\n\n';
                    }
                });
            }

            mensajeRespuesta += 'Tienes 30 minutos para completar el pago.\n';
            mensajeRespuesta += 'Envía tu comprobante de pago a este chat.';

            // Link de WhatsApp con resumen del pedido
            if (config && (config.whatsapp_negocio || config.telefono_contacto)) {
                const telefonoNegocio = config.whatsapp_negocio || config.telefono_contacto;
                const linkConsulta = construirLinkWhatsAppConsulta(telefonoNegocio, {
                    pedidoId: pedidoId,
                    productoNombre: producto.nombre,
                    precio: producto.precio,
                    cliente: cliente.nombre
                });
                mensajeRespuesta += '\n\n¿Consultas? Escribe aquí:\n' + linkConsulta;
            }

            stateManager.setStep(from, 'esperando_voucher', {
                pedidoId,
                productoApartado: {
                    codigo: productId,
                    nombre: producto.nombre,
                    precio: producto.precio
                },
                direccion: cliente.direccion
            });

            return await whatsappService.sendButtonMessage(from, mensajeRespuesta, [
                { title: 'Enviar comprobante', id: 'enviar_voucher' },
                { title: 'Editar datos', id: 'editar_datos' }
            ]);

        } else {
            // NO tenemos datos del cliente - GUARDAR PRODUCTO EN SESIÓN, NO CREAR PEDIDO AÚN
            stateManager.setStep(from, 'datos_nombre', {
                fromWeb: true,
                productoApartado: {
                    codigo: productId,
                    nombre: producto.nombre,
                    precio: producto.precio,
                    cantidad: 1
                },
                businessId: businessId,
                negocioNombre: negocio.nombre
            });

            let mensajeRespuesta = '¡LO APARTASTE!\n\n';
            mensajeRespuesta += negocio.nombre + '\n\n';
            mensajeRespuesta += producto.nombre + '\n';
            mensajeRespuesta += 'S/' + producto.precio.toFixed(2) + '\n\n';
            mensajeRespuesta += 'Tienes 30 minutos para completar tu compra.\n\n';
            mensajeRespuesta += 'Para completar tu pedido, necesito algunos datos.\n\n';
            mensajeRespuesta += 'Paso 1 de 3\n';
            mensajeRespuesta += '¿Cuál es tu nombre completo?';

            return await whatsappService.sendMessage(from, mensajeRespuesta);
        }
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


            return await this.mostrarMenuNegocio(from, negocio.id);
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

        return await this.mostrarMenuNegocio(from, negocioSeleccionado.id);
    }

    // MENU DEL NEGOCIO CON OPCION LIVE

    async mostrarMenuNegocio(from, businessId) {
        const negocio = sheetsService.getBusiness(businessId);
        if (!negocio) {
            return await this.mostrarBienvenida(from);
        }

        const cart = stateManager.getCart(from, businessId);
        const cartTotal = stateManager.getCartTotal(from, businessId);


        const pedidos = await sheetsService.getOrdersByClient(businessId, from);
        const pedidosActivos = pedidos.filter(p =>
            p.estado !== 'ENTREGADO' && p.estado !== 'CANCELADO'
        );

        // Si hay pedidos activos, mostrarlos TODOS directamente
        if (pedidosActivos.length > 0) {
            for (const pedido of pedidosActivos) {
                await this.mostrarDetallePedido(from, businessId, pedido);
            }
            // Si hay carrito, mostrar también recordatorio
            if (cart.length > 0) {
                const mensajeCarrito = '🛒 Tambien tienes un carrito pendiente con ' + cart.length + ' producto(s).\n' +
                    'Escribe "carrito" para verlo.';
                await whatsappService.sendMessage(from, mensajeCarrito);
            }
            return;
        }

        // Si no hay pedidos, mostrar menú normal
        let mensaje = negocio.nombre + '\n\n';

        if (cart.length > 0) {
            mensaje += '🛒 CARRITO: ' + cart.length + ' producto(s) - S/' + cartTotal.toFixed(2) + '\n\n';
        }

        mensaje += 'No tienes pedidos activos.\n';
        mensaje += 'Selecciona una opción:';

        stateManager.setStep(from, 'menu_negocio');

        const botones = [];

        if (cart.length > 0) {
            botones.push({ title: 'Ir a pagar', id: 'pagar' });
            botones.push({ title: 'Ver carrito', id: 'carrito' });
        }

        botones.push({ title: 'Cambiar negocio', id: 'cambiar_negocio' });

        return await whatsappService.sendButtonMessage(from, mensaje, botones);
    }


    // MOSTRAR PEDIDOS PENDIENTES

    async mostrarPedidosPendientes(from, businessId) {
        try {
            const pedidos = await sheetsService.getOrdersByClient(businessId, from);

            // Filtrar solo pedidos activos (no entregados ni cancelados)
            const pedidosActivos = pedidos.filter(p =>
                p.estado !== 'ENTREGADO' && p.estado !== 'CANCELADO'
            );

            // Si solo hay un pedido, mostrar detalle directamente
            if (pedidosActivos.length === 1) {
                return await this.mostrarDetallePedido(from, businessId, pedidosActivos[0]);
            }

            let mensaje = '📦 TUS PEDIDOS ACTIVOS:\n\n';

            pedidosActivos.forEach((pedido, idx) => {
                mensaje += `${idx + 1}. ${pedido.id}\n`;
                mensaje += `   Estado: ${this.formatearEstado(pedido.estado)}\n`;
                mensaje += `   Total: S/${pedido.total.toFixed(2)}\n`;
                mensaje += `   Fecha: ${pedido.fecha}\n\n`;
            });

            // Si hay pocos pedidos, mostrar botones
            if (pedidosActivos.length <= 3) {
                mensaje += 'Selecciona un pedido para ver detalle:';

                const botones = pedidosActivos.slice(0, 3).map(p => ({
                    title: `Ver ${p.id}`,
                    id: `ver_pedido_${p.id}`
                }));

                return await whatsappService.sendButtonMessage(from, mensaje, botones);
            }

            mensaje += 'Escribe el codigo del pedido para ver detalles.';
            return await whatsappService.sendMessage(from, mensaje);
        } catch (error) {
            console.error('Error mostrando pedidos:', error);
        }
    }

    formatearEstado(estado) {
        const estados = {
            'PENDIENTE_PAGO': 'Pendiente de pago',
            'PENDIENTE_VALIDACION': 'Validando voucher',
            'CONFIRMADO': 'Confirmado',
            'EN_PREPARACION': 'En preparacion',
            'ENVIADO': 'Enviado',
            'ENTREGADO': 'Entregado',
            'CANCELADO': 'Cancelado'
        };
        return estados[estado] || estado;
    }

    async mostrarDetallePedido(from, businessId, pedido) {
        const negocio = sheetsService.getBusiness(businessId);

        let mensaje = '📦 DETALLE DEL PEDIDO\n';
        mensaje += (negocio.nombre || '') + '\n\n';
        mensaje += 'Codigo: ' + pedido.id + '\n';
        mensaje += 'Estado: ' + this.formatearEstado(pedido.estado) + '\n';
        mensaje += 'Fecha: ' + pedido.fecha + ' ' + pedido.hora + '\n\n';

        mensaje += 'Productos:\n';
        if (Array.isArray(pedido.items)) {
            pedido.items.forEach(item => {
                mensaje += '- ' + item.cantidad + 'x ' + item.nombre + ' - S/' + item.subtotal.toFixed(2) + '\n';
            });
        } else if (typeof pedido.items === 'string') {
            // Fallback for legacy format if any
            const items = pedido.items.split('|');
            items.forEach(item => {
                const [codigo, nombre, cantidad, precio] = item.split(':');
                mensaje += '- ' + cantidad + 'x ' + nombre + ' - S/' + (parseFloat(cantidad) * parseFloat(precio)).toFixed(2) + '\n';
            });
        }

        mensaje += '\nTotal: S/' + pedido.total.toFixed(2) + '\n\n';

        if (pedido.direccion) {
            mensaje += 'Entrega en:\n' + pedido.direccion + '\n\n';
        }

        if (pedido.estado === 'PENDIENTE_PAGO') {
            mensaje += '💳 MÉTODOS DE PAGO:\n\n';

            // Mostrar métodos de pago desde sheetsService helper
            const metodos = sheetsService.getMetodosPago(config);

            if (metodos.length > 0) {
                for (const metodo of metodos) {
                    if (metodo.tipo === 'yape' || metodo.tipo === 'banco') {
                        // Generalized display
                        mensaje += `${metodo.nombre}: ${metodo.numero || metodo.cuenta}\n`;
                        if (metodo.cci) mensaje += `CCI: ${metodo.cci}\n`;
                        if (metodo.titular) mensaje += `${metodo.titular}\n`;
                        mensaje += '\n';
                    }
                }
            } else if (negocio.cuentasBancarias) {
                // Fallback to legacy parsing if helper returns empty or just in case
                const cuentas = negocio.cuentasBancarias.split('|');
                cuentas.forEach(cuenta => {
                    const [banco, numero] = cuenta.split(':');
                    mensaje += '🏦 ' + banco + '\n';
                    mensaje += '   ' + numero + '\n\n';
                });
            } else {
                mensaje += 'Contacta al vendedor para datos de pago\n\n';
            }

            mensaje += 'Envía tu comprobante de pago a este chat.\n';
            mensaje += '⏰ Tienes 30 minutos para completar el pago';

            // NO SETTING STEP HERE to allow multiple order views without race conditions
            // stateManager.setStep(from, 'esperando_voucher', { pedidoId: pedido.id });

            // Botón para enviar comprobante ESPECIFICO
            return await whatsappService.sendButtonMessage(from, mensaje, [
                { title: 'Enviar comprobante', id: `enviar_voucher_${pedido.id}` }
            ]);

        } else if (pedido.estado === 'PENDIENTE_VALIDACION') {
            mensaje += '⏳ Tu voucher esta siendo validado. Te notificaremos pronto.';

            return await whatsappService.sendButtonMessage(from, mensaje, [
                { title: 'Enviar comprobante', id: `enviar_voucher_${pedido.id}` }
            ]);
        } else {
            mensaje += 'Gracias por tu compra! 🎉';
            return await whatsappService.sendMessage(from, mensaje);
        }
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
        const session = stateManager.getSession(from);
        const nombre = mensaje.trim();

        if (nombre.length < 2) {
            return await whatsappService.sendMessage(from,
                'Por favor, ingresa tu nombre completo (mínimo 2 caracteres).'
            );
        }

        // Preservar datos anteriores de la sesión
        const datosAnteriores = session.data || {};
        stateManager.setStep(from, 'datos_direccion', {
            ...datosAnteriores,
            nombre
        });

        return await whatsappService.sendMessage(from,
            'Nombre: ' + nombre + '\n\n' +
            'Paso 2 de 3\n\n' +
            '¿Cuál es tu dirección completa de entrega?\n' +
            'Incluye distrito y referencia'
        );
    }

    async procesarDatosDireccion(from, mensaje) {
        const session = stateManager.getSession(from);
        const direccion = mensaje.trim();

        if (direccion.length < 10) {
            return await whatsappService.sendMessage(from,
                'Por favor, ingresa una dirección más completa.\n' +
                'Incluye calle, número, distrito y referencia.'
            );
        }

        // Preservar datos anteriores de la sesión
        const datosAnteriores = session.data || {};
        stateManager.setStep(from, 'datos_telefono', {
            ...datosAnteriores,
            direccion
        });

        return await whatsappService.sendMessage(from,
            'Dirección: ' + direccion + '\n\n' +
            'Paso 3 de 3\n\n' +
            '¿Cuál es tu número de teléfono de contacto?'
        );
    }

    async procesarDatosTelefono(from, mensaje) {
        const session = stateManager.getSession(from);
        const telefono = mensaje.replace(/[^0-9]/g, '');

        if (telefono.length < 7) {
            return await whatsappService.sendMessage(from,
                'Por favor, ingresa un número de teléfono válido (mínimo 7 dígitos).'
            );
        }

        // Obtener todos los datos de la sesión
        const sessionData = session.data || {};
        const nombre = sessionData.nombre;
        const direccion = sessionData.direccion;
        const productoApartado = sessionData.productoApartado;
        const businessId = sessionData.businessId || session.businessId;
        const fromWeb = sessionData.fromWeb;

        // Guardar datos del cliente
        const cliente = {
            nombre: nombre,
            direccion: direccion,
            telefono: telefono,
            whatsapp: from
        };

        stateManager.cacheClient(from, businessId, cliente);
        await sheetsService.saveClient(businessId, cliente);

        // Si viene del catálogo web, crear pedido con el producto apartado
        if (fromWeb && productoApartado) {
            const negocio = sheetsService.getBusiness(businessId);

            const pedidoData = {
                whatsapp: from,
                cliente: nombre,
                telefono: telefono,
                direccion: direccion,
                items: [{
                    codigo: productoApartado.codigo,
                    nombre: productoApartado.nombre,
                    cantidad: productoApartado.cantidad || 1,
                    precio: productoApartado.precio
                }],
                total: productoApartado.precio * (productoApartado.cantidad || 1),
                observaciones: 'Apartado desde catálogo web'
            };

            const pedidoResult = await sheetsService.createOrder(businessId, pedidoData);

            if (!pedidoResult.success) {
                return await whatsappService.sendMessage(from,
                    '❌ Error al crear tu pedido.\n\n' +
                    'Por favor, intenta nuevamente.'
                );
            }

            const pedidoId = pedidoResult.pedidoId;
            stateManager.setActivePedido(from, businessId, pedidoId);

            // Obtener configuración del negocio para métodos de pago
            const config = await sheetsService.getBusinessConfig(businessId);

            // Construir mensaje con todos los datos
            let mensaje = '¡LO APARTASTE!\n\n';
            mensaje += (negocio?.nombre || 'Tu pedido') + '\n\n';
            mensaje += productoApartado.nombre + '\n';
            mensaje += 'S/' + productoApartado.precio.toFixed(2) + '\n';
            mensaje += 'Pedido: ' + pedidoId + '\n\n';
            mensaje += 'Datos de entrega:\n';
            mensaje += nombre + '\n';
            mensaje += direccion + '\n\n';

            // Métodos de pago desde configuración del negocio
            if (config) {
                const textoMetodosPago = sheetsService.construirTextoMetodosPago(config);
                if (textoMetodosPago) {
                    mensaje += textoMetodosPago + '\n\n';
                }
            } else if (negocio && negocio.cuentasBancarias) {
                // Fallback al campo legacy si no hay config
                mensaje += 'CUENTAS PARA PAGAR:\n\n';
                const cuentas = negocio.cuentasBancarias.split('|');
                cuentas.forEach(cuenta => {
                    const [banco, numero] = cuenta.split(':');
                    if (banco && numero) {
                        mensaje += banco + '\n' + numero + '\n\n';
                    }
                });
            }

            mensaje += 'Tienes 30 minutos para completar el pago.\n';
            mensaje += 'Envía tu comprobante de pago a este chat.';

            // Link de WhatsApp con resumen del pedido
            if (config && (config.whatsapp_negocio || config.telefono_contacto)) {
                const telefonoNegocio = config.whatsapp_negocio || config.telefono_contacto;
                const linkConsulta = construirLinkWhatsAppConsulta(telefonoNegocio, {
                    pedidoId: pedidoId,
                    productoNombre: productoApartado.nombre,
                    precio: productoApartado.precio,
                    cliente: nombre
                });
                mensaje += '\n\n¿Consultas? Escribe aquí:\n' + linkConsulta;
            }

            stateManager.setStep(from, 'esperando_voucher', {
                pedidoId,
                productoApartado,
                direccion
            });

            return await whatsappService.sendButtonMessage(from, mensaje, [
                { title: 'Enviar comprobante', id: 'enviar_voucher' },
                { title: 'Editar datos', id: 'editar_datos' }
            ]);
        }

        // Flujo normal (carrito de compras)
        return await this.crearPedido(from, businessId, cliente);
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
        let pedidoId = session.data?.pedidoId;
        const businessId = session.businessId;

        // Si no hay pedidoId en la sesión, buscar el último pedido pendiente
        if (!pedidoId && businessId) {
            const pedidos = await sheetsService.getOrdersByClient(businessId, from);
            const pedidoPendiente = pedidos.find(p =>
                p.estado === 'PENDIENTE_PAGO' || p.estado === 'PENDIENTE_VALIDACION'
            );
            if (pedidoPendiente) {
                pedidoId = pedidoPendiente.id;
                stateManager.setStep(from, 'esperando_voucher', { pedidoId });
            }
        }

        if (!pedidoId) {
            return await this.mostrarMenuNegocio(from, businessId);
        }

        if (!mediaUrl) {
            return await whatsappService.sendMessage(from,
                'Por favor, envía una imagen de tu comprobante de pago.\n\n' +
                'Tu código de pedido es: ' + pedidoId + '\n\n' +
                'Puedes enviar múltiples comprobantes si lo necesitas.'
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
        const timestamp = Date.now();
        const filename = `voucher_${pedidoId}_${timestamp}.jpg`;
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
            businessId,
            pedidoId,
            'PENDIENTE_VALIDACION',
            uploadResult.directLink
        );

        // Obtener configuración del negocio para determinar opciones de envío
        const config = await sheetsService.getBusinessConfig(businessId);

        // Verificar si tiene opciones de envío configuradas
        const tieneEnvio = config && (
            config.envio_local_activo === 'SI' ||
            config.envio_nacional_activo === 'SI' ||
            config.recojo_tienda_activo === 'SI'
        );

        // Obtener datos de envío guardados del cliente
        const clienteEnvio = await sheetsService.getClientShippingPreferences(businessId, from);

        if (tieneEnvio && clienteEnvio && clienteEnvio.tipoEnvio) {
            // Cliente tiene datos guardados - pedir confirmación
            stateManager.setData(from, 'preferenciasEnvio', clienteEnvio);
            stateManager.setStep(from, 'confirmar_envio', { ...session.data, pedidoId });

            let mensaje = '✅ ¡Comprobante recibido!\n';
            mensaje += 'Estamos verificando tu pago.\n\n';
            mensaje += '📦 Tus datos de envío guardados:\n\n';

            if (clienteEnvio.tipoEnvio === 'LOCAL') {
                mensaje += `Tipo: Delivery ${clienteEnvio.departamento}\n`;
                mensaje += `Ciudad: ${clienteEnvio.ciudad}\n`;
            } else if (clienteEnvio.tipoEnvio === 'RECOJO') {
                mensaje += 'Tipo: Recojo en tienda\n';
                mensaje += `Dirección: ${config.direccion_tienda || 'Tienda'}\n`;
            } else if (clienteEnvio.tipoEnvio === 'NACIONAL') {
                mensaje += 'Tipo: Envío por courier\n';
                mensaje += `Empresa: ${clienteEnvio.empresa}\n`;
                mensaje += `Sede: ${clienteEnvio.sede}\n`;
            }

            mensaje += '\n¿Enviamos a esta dirección?';

            return await whatsappService.sendButtonMessage(from, mensaje, [
                { id: 'confirmar_envio_si', title: 'Sí, confirmar' },
                { id: 'confirmar_envio_no', title: 'Cambiar datos' }
            ]);

        } else if (tieneEnvio) {
            // Preguntar ciudad para determinar tipo de envío
            stateManager.setStep(from, 'preguntar_ciudad', {
                ...session.data,
                pedidoId
            });

            return await whatsappService.sendMessage(from,
                '✅ ¡Comprobante recibido!\n' +
                'Estamos verificando tu pago.\n\n' +
                'Ayúdanos con el envío:\n' +
                '¿En qué ciudad te encuentras?\n' +
                '(Ej: Lima, Arequipa, Trujillo)'
            );
        } else {
            // Sin opciones de envío - finalizar
            stateManager.clearState(from);

            return await whatsappService.sendMessage(from,
                '✅ ¡Comprobante recibido!\n\n' +
                'Estamos verificando tu pago.\n' +
                'Te notificaremos cuando esté confirmado.\n\n' +
                `Código de pedido: ${pedidoId}`
            );
        }
    }

    // ========================================
    // FLUJO DE ENVÍO POST-PAGO
    // ========================================

    async procesarCiudad(from, ciudad) {
        const { detectarDepartamento, esEnvioLocal } = require('./utils/ciudades');

        const session = stateManager.getSession(from);
        const sessionData = session.data || {};
        const businessId = session.businessId;
        const config = await sheetsService.getBusinessConfig(businessId);

        if (!config) {
            stateManager.setStep(from, 'esperando_codigo');
            return await whatsappService.sendMessage(from,
                '✅ ¡Pedido confirmado!\n\n' +
                'Te contactaremos para coordinar la entrega.'
            );
        }

        // Detectar departamento
        const departamentoCliente = detectarDepartamento(ciudad);

        if (!departamentoCliente) {
            return await whatsappService.sendMessage(from,
                `No encontré "${ciudad}" en mi lista.\n\n` +
                '¿En qué departamento estás?\n' +
                '(Ej: Lima, Arequipa, Junín, Cusco, La Libertad, Piura...)'
            );
        }

        // (Datos se guardarán al cambiar de paso)

        // Determinar si es local o nacional
        const departamentoNegocio = config.departamento || 'Lima';
        const local = esEnvioLocal(departamentoNegocio, departamentoCliente);

        // Construir opciones de envío
        const opciones = [];

        if (local && config.envio_local_activo === 'SI') {
            opciones.push({
                id: 'envio_local',
                title: `Delivery ${departamentoNegocio}`,
                costo: config.envio_local_costo || '0'
            });
        }

        if (config.recojo_tienda_activo === 'SI') {
            opciones.push({
                id: 'recojo_tienda',
                title: 'Recojo en tienda'
            });
        }

        if (config.envio_nacional_activo === 'SI') {
            opciones.push({
                id: 'envio_nacional',
                title: 'Envío por courier'
            });
        }

        if (opciones.length === 0) {
            stateManager.setStep(from, 'esperando_codigo');
            return await whatsappService.sendMessage(from,
                '✅ ¡Pedido confirmado!\n\n' +
                'Estás en: ' + departamentoCliente + '\n\n' +
                'Te contactaremos para coordinar la entrega.\n' +
                (config.telefono_contacto ? `Consultas: ${config.telefono_contacto}` : '')
            );
        }

        // Guardar opciones en sesión
        stateManager.setStep(from, 'seleccionar_envio', {
            ...sessionData,
            departamentoCliente,
            ciudadCliente: ciudad,
            opcionesEnvio: opciones
        });

        let mensaje = '';
        if (local) {
            mensaje = `¡Perfecto! Estás en ${departamentoCliente}, igual que nosotros.\n\n`;
        } else {
            mensaje = `Tu pedido será enviado a ${departamentoCliente}.\n\n`;
        }
        mensaje += '¿Cómo quieres recibir tu pedido?';

        // WhatsApp permite máximo 3 botones
        const botones = opciones.slice(0, 3).map(op => ({
            id: op.id,
            title: op.title
        }));

        return await whatsappService.sendButtonMessage(from, mensaje, botones);
    }

    async procesarSeleccionEnvio(from, opcionId) {
        const session = stateManager.getSession(from);
        const sessionData = session.data || {};
        const businessId = session.businessId;
        const config = await sheetsService.getBusinessConfig(businessId);
        const pedidoId = sessionData.pedidoId;
        const departamentoCliente = sessionData.departamentoCliente; // Get customer's department from session

        // Guardar datos del cliente
        if (sessionData.ciudadCliente || departamentoCliente) {
            await sheetsService.saveClient(businessId, {
                whatsapp: from,
                departamento: departamentoCliente,
                ciudad: sessionData.ciudadCliente
            });
        }

        if (opcionId === 'envio_local') {
            // Envío local - Finalizar
            const costoEnvio = parseFloat(config.envio_local_costo || 0);
            const departamento = config.departamento || 'Lima'; // Business's department

            // Guardar preferencia LOCAL
            await sheetsService.updateClientShippingPreferences(businessId, from, {
                ciudad: sessionData.ciudadCliente,
                departamento: sessionData.departamentoCliente,
                tipoEnvio: 'LOCAL',
                empresa: null,
                sede: null,
                sedeDireccion: null
            });


            await sheetsService.updateOrderShipping(businessId, pedidoId, {
                departamento_cliente: departamentoCliente,
                ciudad_cliente: sessionData.ciudadCliente,
                tipo_envio: 'LOCAL',
                metodo_envio: `Delivery ${departamento}`,
                costo_envio: costoEnvio,
                detalle: sessionData.direccion // Dirección del cliente para el pedido
            });

            return await this.enviarConfirmacionFinal(from, config, {
                tipo: 'LOCAL',
                metodo: `Delivery ${departamento}`,
                costo: costoEnvio,
                detalle: sessionData.direccion
            });

        } else if (opcionId === 'recojo_tienda') {
            // Recojo en tienda - Finalizar
            await sheetsService.updateOrderShipping(businessId, pedidoId, {
                departamento_cliente: departamentoCliente,
                ciudad_cliente: sessionData.ciudadCliente,
                tipo_envio: 'RECOJO',
                metodo_envio: 'Recojo en tienda',
                costo_envio: 0
            });

            // Guardar preferencia RECOJO
            await sheetsService.updateClientShippingPreferences(businessId, from, {
                ciudad: sessionData.ciudadCliente,
                departamento: sessionData.departamentoCliente,
                tipoEnvio: 'RECOJO',
                empresa: null,
                sede: null,
                sedeDireccion: config.direccion_tienda
            });

            return await this.enviarConfirmacionFinal(from, config, {
                tipo: 'RECOJO',
                metodo: 'Recojo en tienda',
                costo: 0,
                detalle: config.direccion_tienda || 'Consultar dirección',
                horario: config.recojo_tienda_horario || 'Consultar horario'
            });

        } else if (opcionId === 'envio_nacional') {
            // Envío nacional - Preguntar empresa
            const empresasHabilitadas = (config.empresas_envio || 'Shalom,Olva').split(',').map(e => e.trim());

            stateManager.setStep(from, 'seleccionar_empresa', sessionData);

            // Máximo 3 botones
            const botones = empresasHabilitadas.slice(0, 3).map(empresa => ({
                id: `empresa_${empresa.toLowerCase().replace(/\s+/g, '_')}`,
                title: empresa
            }));

            return await whatsappService.sendButtonMessage(from,
                '¿Con qué empresa de courier prefieres?',
                botones
            );
        }

        return await whatsappService.sendMessage(from, 'Opción no reconocida.');
    }

    async procesarSeleccionEmpresa(from, empresaId) {
        const empresa = empresaId.replace('empresa_', '').replace(/_/g, ' ');
        const empresaNombre = empresa.charAt(0).toUpperCase() + empresa.slice(1);

        const sessionData = stateManager.getData(from);
        stateManager.setData(from, 'empresaEnvio', empresaNombre);

        // Obtener departamento del cliente desde la sesión
        const departamentoCliente = sessionData.departamentoCliente;

        if (!departamentoCliente) {
            await whatsappService.sendMessage(from,
                'Hubo un error. Por favor indica nuevamente tu ciudad.'
            );
            stateManager.setStep(from, 'preguntar_ciudad', sessionData);
            return;
        }

        // Obtener sedes de la empresa EN EL DEPARTAMENTO DEL CLIENTE
        const sedes = await sheetsService.getSedesEmpresa(empresaNombre, departamentoCliente);

        if (sedes.length === 0) {
            // No hay sedes en ese departamento
            await whatsappService.sendMessage(from,
                `${empresaNombre} no tiene sedes en ${departamentoCliente}.\n` +
                'Por favor selecciona otra empresa de envío.'
            );

            // Volver a mostrar empresas
            const businessId = stateManager.getActiveBusiness(from);
            const config = await sheetsService.getBusinessConfig(businessId);
            const empresasHabilitadas = (config.empresas_envio || 'Shalom,Olva').split(',').map(e => e.trim());

            stateManager.setStep(from, 'seleccionar_empresa', sessionData);

            const botones = empresasHabilitadas.slice(0, 3).map(emp => ({
                id: `empresa_${emp.toLowerCase()}`,
                title: emp
            }));

            return await whatsappService.sendButtonMessage(from,
                '¿Con qué empresa de courier prefieres?',
                botones
            );
        }

        stateManager.setStep(from, 'seleccionar_sede', sessionData);

        // Mostrar sedes del departamento del cliente
        if (sedes.length <= 3) {
            // Usar botones
            const botones = sedes.map(sede => ({
                id: `sede_${sede.sede.toLowerCase().replace(/\s+/g, '_')}`,
                title: sede.sede
            }));

            await whatsappService.sendButtonMessage(from,
                `Sedes de ${empresaNombre} en ${departamentoCliente}:\n\n` +
                `¿En cuál recogerás tu pedido?`,
                botones
            );
        } else {
            // Más de 3 sedes - mostrar lista numerada
            let mensaje = `Sedes de ${empresaNombre} en ${departamentoCliente}:\n\n`;

            sedes.forEach((sede, index) => {
                mensaje += `${index + 1}. ${sede.sede}\n`;
                mensaje += `   ${sede.direccion}, ${sede.distrito}\n\n`;
            });

            mensaje += 'Responde con el número de la sede.';

            // Guardar sedes en sesión para procesar respuesta numérica
            stateManager.setData(from, 'sedesDisponibles', sedes);

            await whatsappService.sendMessage(from, mensaje);
        }
    }

    async procesarSeleccionSede(from, respuesta) {
        const sessionData = stateManager.getData(from);
        const businessId = stateManager.getActiveBusiness(from);
        const config = await sheetsService.getBusinessConfig(businessId);
        const pedidoId = sessionData.pedidoId;
        const empresaNombre = sessionData.empresaEnvio;
        const departamentoCliente = sessionData.departamentoCliente;

        let sedeSeleccionada = null;

        // Verificar si es respuesta numérica o ID de botón
        if (/^\d+$/.test(respuesta)) {
            // Respuesta numérica
            const sedesDisponibles = sessionData.sedesDisponibles;
            const indice = parseInt(respuesta) - 1;

            if (!sedesDisponibles || indice < 0 || indice >= sedesDisponibles.length) {
                return await whatsappService.sendMessage(from,
                    'Número no válido. Por favor selecciona un número de la lista.'
                );
            }

            sedeSeleccionada = sedesDisponibles[indice];

        } else {
            // Respuesta de botón (sede_lima_centro)
            const sedeCodigo = respuesta.replace('sede_', '').replace(/_/g, ' ');

            const sedes = await sheetsService.getSedesEmpresa(empresaNombre, departamentoCliente);
            sedeSeleccionada = sedes.find(s =>
                s.sede.toLowerCase() === sedeCodigo.toLowerCase()
            );
        }

        if (!sedeSeleccionada) {
            return await whatsappService.sendMessage(from,
                'Sede no encontrada. Por favor intenta de nuevo.'
            );
        }

        // Actualizar pedido con datos de envío
        await sheetsService.updateOrderShipping(businessId, pedidoId, {
            departamento_cliente: sessionData.departamentoCliente,
            ciudad_cliente: sessionData.ciudadCliente,
            tipo_envio: 'NACIONAL',
            metodo_envio: `${empresaNombre} - ${sedeSeleccionada.sede}`,
            empresa_envio: empresaNombre,
            sede_envio: sedeSeleccionada.sede,
            sede_direccion: `${sedeSeleccionada.direccion}, ${sedeSeleccionada.distrito}`,
            sede_departamento: sedeSeleccionada.departamento,
            sede_telefono: sedeSeleccionada.telefono || '',
            sede_telefono: sedeSeleccionada.telefono || '',
            costo_envio: parseFloat(config.envio_nacional_costo || 0)
        });

        // Guardar preferencias de envío del cliente para futuros pedidos
        await sheetsService.updateClientShippingPreferences(businessId, from, {
            ciudad: sessionData.ciudadCliente,
            departamento: sessionData.departamentoCliente,
            tipoEnvio: 'NACIONAL',
            empresa: empresaNombre,
            sede: sedeSeleccionada.sede,
            sedeDireccion: `${sedeSeleccionada.direccion}, ${sedeSeleccionada.distrito}`
        });

        // Enviar confirmación final
        let mensaje = '✅ ¡Pedido confirmado!\n\n';
        mensaje += `Código: ${pedidoId}\n\n`;
        mensaje += `Tu pedido será enviado a:\n`;
        mensaje += `${empresaNombre} - ${sedeSeleccionada.sede}\n`;
        mensaje += `${sedeSeleccionada.direccion}, ${sedeSeleccionada.distrito}\n`;
        mensaje += `${sedeSeleccionada.departamento}\n`;

        if (sedeSeleccionada.telefono) {
            mensaje += `Tel: ${sedeSeleccionada.telefono}\n`;
        }

        mensaje += '\nTe enviaremos el código de rastreo cuando despachemos tu pedido.';

        if (config && config.telefono_contacto) {
            mensaje += `\n\n¿Consultas? ${config.telefono_contacto}`;
        }

        await whatsappService.sendMessage(from, mensaje);

        // Limpiar estado
        stateManager.clearState(from);
    }

    async enviarConfirmacionFinal(from, config, envioData) {
        const session = stateManager.getSession(from);
        const sessionData = session.data || {};

        let mensaje = '✅ ¡Pedido confirmado!\n\n';
        mensaje += `Código: ${sessionData.pedidoId || 'Ver correo'}\n\n`;

        if (envioData.tipo === 'LOCAL') {
            mensaje += `Envío: ${envioData.metodo}\n`;
            if (envioData.costo > 0) {
                mensaje += `Costo envío: S/${envioData.costo.toFixed(2)}\n\n`;
            }
            mensaje += `Dirección de entrega:\n${envioData.detalle || 'Ver pedido'}\n\n`;
            mensaje += 'Te contactaremos para coordinar la entrega.\n';

        } else if (envioData.tipo === 'RECOJO') {
            mensaje += 'Método: Recojo en tienda\n\n';
            mensaje += `Dirección:\n${envioData.detalle}\n`;
            if (envioData.horario) {
                mensaje += `Horario: ${envioData.horario}\n`;
            }
            mensaje += '\nTe avisaremos cuando tu pedido esté listo para recoger.\n';

        } else if (envioData.tipo === 'NACIONAL') {
            mensaje += `Envío: ${envioData.metodo}\n\n`;
            if (envioData.direccion) {
                mensaje += `Agencia:\n${envioData.direccion}\n`;
            }
            if (envioData.telefono) {
                mensaje += `Tel: ${envioData.telefono}\n`;
            }
            mensaje += '\nTe enviaremos el código de rastreo cuando despachemos.\n';
        }

        mensaje += '\n━━━━━━━━━━━━━━━━━━━━\n';

        if (config && (config.whatsapp_negocio || config.telefono_contacto)) {
            const telefonoConsulta = config.whatsapp_negocio || config.telefono_contacto;

            // Datos para el link de consulta
            const datosPedido = {
                pedidoId: sessionData.pedidoId,
                productoNombre: sessionData.productoApartado ? sessionData.productoApartado.nombre : 'mi pedido',
                precio: sessionData.productoApartado ? sessionData.productoApartado.precio : 0,
                cliente: sessionData.nombre || 'Cliente'
            };

            const linkConsulta = construirLinkWhatsAppConsulta(telefonoConsulta, datosPedido);

            mensaje += '¿Consultas sobre tu pedido? 🤔\n';
            mensaje += `👉 ${linkConsulta}`;
        } else {
            mensaje += '¡Gracias por tu compra! 🎉';
        }

        // Limpiar estado
        stateManager.clearActivePedido(from);
        stateManager.setStep(from, 'esperando_codigo');

        return await whatsappService.sendMessage(from, mensaje);
    }
    async confirmarEnvioGuardado(from) {
        const session = stateManager.getSession(from);
        const sessionData = session.data || {};
        const businessId = session.businessId || stateManager.getActiveBusiness(from);
        const config = await sheetsService.getBusinessConfig(businessId);
        const pedidoId = sessionData.pedidoId;
        const preferencias = sessionData.preferenciasEnvio;

        // Actualizar pedido con datos de envío guardados
        const updateData = {
            ciudad_cliente: preferencias.ciudad || '',
            departamento_cliente: preferencias.departamento || '',
            tipo_envio: preferencias.tipoEnvio,
            metodo_envio: '', // se llena abajo
            costo_envio: 0 // se llena abajo
        };

        let mensaje = '✅ ¡Pedido confirmado!\n\n';
        mensaje += `Código: ${pedidoId}\n\n`;
        mensaje += '📦 Datos de envío:\n';

        if (preferencias.tipoEnvio === 'LOCAL') {
            updateData.metodo_envio = `Delivery ${preferencias.departamento}`;
            updateData.costo_envio = parseFloat(config.envio_local_costo || 0);

            mensaje += `Delivery ${preferencias.departamento}\n`;
            mensaje += `Costo: S/${updateData.costo_envio.toFixed(2)}\n`;

        } else if (preferencias.tipoEnvio === 'RECOJO') {
            updateData.metodo_envio = 'Recojo en tienda';
            updateData.costo_envio = 0;

            mensaje += 'Recojo en tienda\n';
            mensaje += `${config.direccion_tienda || 'Tienda'}\n`;

        } else if (preferencias.tipoEnvio === 'NACIONAL') {
            updateData.metodo_envio = `${preferencias.empresa} - ${preferencias.sede}`;
            updateData.empresa_envio = preferencias.empresa;
            updateData.sede_envio = preferencias.sede;
            updateData.sede_direccion = preferencias.sedeDireccion;
            updateData.costo_envio = parseFloat(config.envio_nacional_costo || 0);

            mensaje += `${preferencias.empresa} - ${preferencias.sede}\n`;
            mensaje += `${preferencias.sedeDireccion}\n`;
        }

        // Actualizar Sheets
        await sheetsService.updateOrderShipping(businessId, pedidoId, updateData);

        mensaje += '\nTe notificaremos cuando tu pedido sea despachado.';

        if (config.telefono_contacto) {
            mensaje += `\n\n¿Consultas? ${config.telefono_contacto}`;
        }

        await whatsappService.sendMessage(from, mensaje);
        stateManager.clearState(from);
    }

    async cambiarDatosEnvio(from) {
        const sessionData = stateManager.getData(from);

        // Iniciar flujo normal de selección de envío
        stateManager.setStep(from, 'preguntar_ciudad', sessionData);

        return await whatsappService.sendMessage(from,
            'Entendido, vamos a usar otros datos de envío.\n\n' +
            '¿En qué ciudad te encuentras?\n' +
            '(Ej: Lima, Arequipa, Trujillo, Cusco)'
        );
    }
}

module.exports = new MessageHandler();
