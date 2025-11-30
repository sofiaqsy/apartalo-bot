/**
 * Admin Routes - API de Administración
 * Gestión de productos, pedidos, negocios y LIVE Commerce
 */

const express = require('express');
const router = express.Router();
const sheetsService = require('./sheets-service');
const liveManager = require('./live-manager');
const whatsappService = require('./whatsapp-service');

// ========================================
// NEGOCIOS
// ========================================

// GET /api/negocios - Listar todos los negocios
router.get('/negocios', async (req, res) => {
    try {
        const negocios = sheetsService.getBusinesses();
        res.json({
            success: true,
            count: negocios.length,
            data: negocios
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/negocios/:id - Obtener un negocio
router.get('/negocios/:id', async (req, res) => {
    try {
        const negocio = sheetsService.getBusiness(req.params.id);
        if (!negocio) {
            return res.status(404).json({ success: false, error: 'Negocio no encontrado' });
        }
        res.json({ success: true, data: negocio });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/negocios/reload - Recargar negocios desde Sheets
router.post('/negocios/reload', async (req, res) => {
    try {
        const negocios = await sheetsService.loadBusinesses();
        res.json({
            success: true,
            message: 'Negocios recargados',
            count: negocios.length,
            data: negocios
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// PRODUCTOS / INVENTARIO
// ========================================

// GET /api/:businessId/productos - Listar productos
router.get('/:businessId/productos', async (req, res) => {
    try {
        const { businessId } = req.params;
        const { estado, disponible } = req.query;
        
        let productos = await sheetsService.getInventory(businessId, true);
        
        // Filtrar por estado si se especifica
        if (estado) {
            productos = productos.filter(p => p.estado.toUpperCase() === estado.toUpperCase());
        }
        
        // Filtrar solo disponibles
        if (disponible === 'true') {
            productos = productos.filter(p => p.disponible > 0);
        }
        
        res.json({
            success: true,
            businessId,
            count: productos.length,
            data: productos
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/:businessId/productos/:codigo - Obtener un producto
router.get('/:businessId/productos/:codigo', async (req, res) => {
    try {
        const { businessId, codigo } = req.params;
        const producto = await sheetsService.getProductByCode(businessId, codigo);
        
        if (!producto) {
            return res.status(404).json({ success: false, error: 'Producto no encontrado' });
        }
        
        res.json({ success: true, data: producto });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/:businessId/upload-image - Subir imagen a Google Drive
router.post('/:businessId/upload-image', async (req, res) => {
    try {
        const { businessId } = req.params;
        const { base64, mimeType, filename } = req.body;
        
        if (!base64) {
            return res.status(400).json({ success: false, error: 'Imagen requerida' });
        }
        
        // Convertir base64 a buffer
        const imageBuffer = Buffer.from(base64, 'base64');
        
        // Generar nombre único
        const timestamp = Date.now();
        const ext = (mimeType || 'image/jpeg').split('/')[1] || 'jpg';
        const uniqueFilename = `producto_${businessId}_${timestamp}.${ext}`;
        
        // Subir a Google Drive
        const uploadResult = await sheetsService.uploadImageToDrive(
            imageBuffer,
            uniqueFilename,
            mimeType || 'image/jpeg'
        );
        
        if (!uploadResult.success) {
            return res.status(500).json({ success: false, error: uploadResult.error || 'Error subiendo imagen' });
        }
        
        res.json({
            success: true,
            url: uploadResult.directLink,
            fileId: uploadResult.fileId
        });
        
    } catch (error) {
        console.error('Error subiendo imagen:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/:businessId/productos - Crear producto
router.post('/:businessId/productos', async (req, res) => {
    try {
        const { businessId } = req.params;
        const { codigo, nombre, descripcion, precio, stock, imagenUrl } = req.body;
        
        if (!nombre || precio === undefined || stock === undefined) {
            return res.status(400).json({ 
                success: false, 
                error: 'Campos requeridos: nombre, precio, stock' 
            });
        }
        
        const result = await sheetsService.createProduct(businessId, {
            codigo: codigo || null,
            nombre,
            descripcion: descripcion || '',
            precio: parseFloat(precio),
            stock: parseInt(stock),
            imagenUrl: imagenUrl || '',
            estado: 'ACTIVO'
        });
        
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/:businessId/productos/:codigo - Actualizar producto
router.put('/:businessId/productos/:codigo', async (req, res) => {
    try {
        const { businessId, codigo } = req.params;
        const updates = req.body;
        
        const result = await sheetsService.updateProduct(businessId, codigo, updates);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/:businessId/productos/:codigo/stock - Actualizar solo stock
router.put('/:businessId/productos/:codigo/stock', async (req, res) => {
    try {
        const { businessId, codigo } = req.params;
        const { stock, stockReservado } = req.body;
        
        const result = await sheetsService.updateProductStock(businessId, codigo, {
            stock: stock !== undefined ? parseInt(stock) : undefined,
            stockReservado: stockReservado !== undefined ? parseInt(stockReservado) : undefined
        });
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/:businessId/productos/:codigo - Desactivar producto
router.delete('/:businessId/productos/:codigo', async (req, res) => {
    try {
        const { businessId, codigo } = req.params;
        const result = await sheetsService.updateProduct(businessId, codigo, { estado: 'INACTIVO' });
        res.json({ success: true, message: 'Producto desactivado', data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/:businessId/productos/:codigo/liberar - Liberar stock reservado
router.post('/:businessId/productos/:codigo/liberar', async (req, res) => {
    try {
        const { businessId, codigo } = req.params;
        const { cantidad } = req.body;
        
        if (!cantidad || cantidad < 1) {
            return res.status(400).json({ success: false, error: 'Cantidad debe ser mayor a 0' });
        }
        
        const result = await sheetsService.releaseStock(businessId, codigo, parseInt(cantidad));
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// LIVE COMMERCE
// ========================================

// GET /api/:businessId/live/stats - Estadísticas del LIVE
router.get('/:businessId/live/stats', async (req, res) => {
    try {
        const { businessId } = req.params;
        const stats = liveManager.getStats(businessId);
        
        res.json({
            success: true,
            businessId,
            data: stats
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/:businessId/live/subscribers - Lista de suscritos
router.get('/:businessId/live/subscribers', async (req, res) => {
    try {
        const { businessId } = req.params;
        const subscribers = liveManager.getSubscribers(businessId);
        
        res.json({
            success: true,
            businessId,
            count: subscribers.length,
            data: subscribers
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/:businessId/live/broadcast/:codigo - Enviar producto a todos los suscritos
router.post('/:businessId/live/broadcast/:codigo', async (req, res) => {
    try {
        const { businessId, codigo } = req.params;
        
        // Obtener producto
        const producto = await sheetsService.getProductByCode(businessId, codigo);
        if (!producto) {
            return res.status(404).json({ success: false, error: 'Producto no encontrado' });
        }
        
        if (producto.disponible < 1) {
            return res.status(400).json({ success: false, error: 'Producto sin stock disponible' });
        }
        
        // Obtener suscritos activos
        const subscribers = liveManager.getSubscribers(businessId);
        
        if (subscribers.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'No hay usuarios suscritos al LIVE' 
            });
        }
        
        // Publicar producto en el live manager
        liveManager.publishProduct(businessId, producto);
        
        // Enviar mensaje a cada suscrito
        let enviados = 0;
        let errores = 0;
        
        for (const sub of subscribers) {
            try {
                // Crear mensaje SIN emojis y SIN stock
                let mensaje = `\n`;
                mensaje += `*${producto.nombre}*\n`;
                if (producto.descripcion) {
                    mensaje += `${producto.descripcion}\n`;
                }
                mensaje += `Precio: S/${producto.precio.toFixed(2)}\n\n`;
                mensaje += `El primero en tocar se lo lleva`;
                
                // Enviar con imagen si tiene
                if (producto.imagenUrl) {
                    await whatsappService.sendImageMessage(sub.whatsapp, producto.imagenUrl, mensaje);
                }
                
                // Enviar boton de reserva con texto "ApartaLo"
                await whatsappService.sendButtonMessage(sub.whatsapp, 
                    producto.imagenUrl ? 'Toca el boton para reservar' : mensaje,
                    [{ 
                        title: 'ApartaLo',
                        id: `RESERVAR_${businessId}_${producto.codigo}`
                    }]
                );
                
                enviados++;
            } catch (err) {
                console.error(`Error enviando a ${sub.whatsapp}:`, err.message);
                errores++;
            }
        }
        
        res.json({
            success: true,
            message: `Producto enviado a ${enviados} usuarios`,
            data: {
                producto: producto.codigo,
                subscribersTotal: subscribers.length,
                enviados,
                errores
            }
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/:businessId/live/products - Productos activos en el LIVE
router.get('/:businessId/live/products', async (req, res) => {
    try {
        const { businessId } = req.params;
        const products = liveManager.getLiveProducts(businessId);
        
        res.json({
            success: true,
            businessId,
            count: products.length,
            data: products
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/:businessId/live/products/:codigo - Quitar producto del LIVE
router.delete('/:businessId/live/products/:codigo', async (req, res) => {
    try {
        const { businessId, codigo } = req.params;
        const cleared = liveManager.clearLiveProduct(businessId, codigo);
        
        res.json({
            success: cleared,
            message: cleared ? 'Producto removido del LIVE' : 'Producto no encontrado en LIVE'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/:businessId/live/notify - Notificar a todos los suscritos (mensaje personalizado)
router.post('/:businessId/live/notify', async (req, res) => {
    try {
        const { businessId } = req.params;
        const { mensaje } = req.body;
        
        if (!mensaje) {
            return res.status(400).json({ success: false, error: 'Mensaje requerido' });
        }
        
        const subscribers = liveManager.getSubscribers(businessId);
        const negocio = sheetsService.getBusiness(businessId);
        
        let enviados = 0;
        for (const sub of subscribers) {
            try {
                await whatsappService.sendMessage(sub.whatsapp, 
                    `*${negocio.nombre}*\n\n${mensaje}`
                );
                enviados++;
            } catch (err) {
                console.error(`Error enviando a ${sub.whatsapp}:`, err.message);
            }
        }
        
        res.json({
            success: true,
            message: `Notificacion enviada a ${enviados} usuarios`,
            enviados
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// PEDIDOS
// ========================================

// GET /api/:businessId/pedidos - Listar pedidos
router.get('/:businessId/pedidos', async (req, res) => {
    try {
        const { businessId } = req.params;
        const { estado, fecha, limit } = req.query;
        
        let pedidos = await sheetsService.getAllOrders(businessId);
        
        // Filtrar por estado
        if (estado) {
            pedidos = pedidos.filter(p => p.estado.toUpperCase() === estado.toUpperCase());
        }
        
        // Filtrar por fecha
        if (fecha) {
            pedidos = pedidos.filter(p => p.fecha === fecha);
        }
        
        // Limitar resultados
        if (limit) {
            pedidos = pedidos.slice(0, parseInt(limit));
        }
        
        res.json({
            success: true,
            businessId,
            count: pedidos.length,
            data: pedidos
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/:businessId/pedidos/stats - Estadísticas de pedidos
router.get('/:businessId/pedidos/stats', async (req, res) => {
    try {
        const { businessId } = req.params;
        const pedidos = await sheetsService.getAllOrders(businessId);
        
        const stats = {
            total: pedidos.length,
            porEstado: {},
            montoTotal: 0,
            hoy: 0
        };
        
        const hoy = new Date().toLocaleDateString('es-PE');
        
        pedidos.forEach(p => {
            // Contar por estado
            stats.porEstado[p.estado] = (stats.porEstado[p.estado] || 0) + 1;
            // Sumar monto
            stats.montoTotal += p.total || 0;
            // Contar de hoy
            if (p.fecha === hoy) stats.hoy++;
        });
        
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/:businessId/pedidos/:id - Obtener un pedido
router.get('/:businessId/pedidos/:id', async (req, res) => {
    try {
        const { businessId, id } = req.params;
        const pedido = await sheetsService.getOrderById(businessId, id);
        
        if (!pedido) {
            return res.status(404).json({ success: false, error: 'Pedido no encontrado' });
        }
        
        res.json({ success: true, data: pedido });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/:businessId/pedidos/:id/estado - Actualizar estado del pedido
router.put('/:businessId/pedidos/:id/estado', async (req, res) => {
    try {
        const { businessId, id } = req.params;
        const { estado, observaciones } = req.body;
        
        const estadosValidos = [
            'PENDIENTE_PAGO',
            'PENDIENTE_VALIDACION',
            'CONFIRMADO',
            'EN_PREPARACION',
            'ENVIADO',
            'ENTREGADO',
            'CANCELADO'
        ];
        
        if (!estado || !estadosValidos.includes(estado.toUpperCase())) {
            return res.status(400).json({ 
                success: false, 
                error: `Estado invalido. Valores permitidos: ${estadosValidos.join(', ')}` 
            });
        }
        
        const result = await sheetsService.updateOrderStatus(businessId, id, estado.toUpperCase());
        
        if (observaciones) {
            await sheetsService.updateOrderObservations(businessId, id, observaciones);
        }
        
        res.json({
            success: true,
            message: `Pedido ${id} actualizado a ${estado}`,
            data: result
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/:businessId/pedidos/:id/cancelar - Cancelar pedido y liberar stock
router.post('/:businessId/pedidos/:id/cancelar', async (req, res) => {
    try {
        const { businessId, id } = req.params;
        const { motivo } = req.body;
        
        // Obtener pedido
        const pedido = await sheetsService.getOrderById(businessId, id);
        if (!pedido) {
            return res.status(404).json({ success: false, error: 'Pedido no encontrado' });
        }
        
        // Liberar stock de cada producto
        if (pedido.productos) {
            const items = pedido.productos.split('|');
            for (const item of items) {
                const [codigo, , cantidad] = item.split(':');
                if (codigo && cantidad) {
                    await sheetsService.releaseStock(businessId, codigo, parseInt(cantidad));
                }
            }
        }
        
        // Actualizar estado
        await sheetsService.updateOrderStatus(businessId, id, 'CANCELADO');
        
        if (motivo) {
            await sheetsService.updateOrderObservations(businessId, id, `CANCELADO: ${motivo}`);
        }
        
        res.json({
            success: true,
            message: `Pedido ${id} cancelado y stock liberado`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// CLIENTES
// ========================================

// GET /api/:businessId/clientes - Listar clientes
router.get('/:businessId/clientes', async (req, res) => {
    try {
        const { businessId } = req.params;
        const clientes = await sheetsService.getAllClients(businessId);
        
        res.json({
            success: true,
            businessId,
            count: clientes.length,
            data: clientes
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/:businessId/clientes/:whatsapp - Buscar cliente por WhatsApp
router.get('/:businessId/clientes/:whatsapp', async (req, res) => {
    try {
        const { businessId, whatsapp } = req.params;
        const cliente = await sheetsService.findClient(businessId, whatsapp);
        
        if (!cliente) {
            return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
        }
        
        // Obtener historial de pedidos
        const pedidos = await sheetsService.getOrdersByClient(businessId, whatsapp);
        
        res.json({ 
            success: true, 
            data: {
                ...cliente,
                pedidos: pedidos
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
