/**
 * Landing API Routes
 * Rutas para el catálogo público de productos
 */

const express = require('express');
const router = express.Router();

// Importar servicios
let sheetsService;

try {
    sheetsService = require('./sheets-service');
} catch (e) {
    console.log('⚠️ Servicios no disponibles, usando mock');
}

// WhatsApp de ApartaLo
const APARTALO_WHATSAPP = '19895335574';

/**
 * GET /api/businesses
 * Lista todos los negocios activos
 */
router.get('/api/businesses', async (req, res) => {
    try {
        if (!sheetsService) {
            return res.json({
                success: true,
                businesses: []
            });
        }

        const negocios = sheetsService.getBusinesses();
        
        const businesses = negocios.map(n => ({
            id: n.id,
            nombre: n.nombre,
            descripcion: n.descripcion || 'Catálogo de productos',
            imagen: n.logoUrl || '',
            whatsapp: n.whatsappNumber || '',
            tiktok: n.tiktokUrl || ''
        }));
        
        res.json({
            success: true,
            businesses: businesses
        });
        
    } catch (error) {
        console.error('Error obteniendo negocios:', error);
        res.status(500).json({
            success: false,
            error: 'Error obteniendo negocios'
        });
    }
});

/**
 * GET /api/products/:businessId
 * Obtiene productos de un negocio específico
 */
router.get('/api/products/:businessId', async (req, res) => {
    try {
        const { businessId } = req.params;
        
        if (!sheetsService) {
            return res.json({
                success: true,
                business: { id: businessId, nombre: 'Demo', imagen: '', tiktok: '', whatsapp: '' },
                products: []
            });
        }

        // Obtener negocio
        const negocio = sheetsService.getBusiness(businessId);
        
        if (!negocio) {
            return res.status(404).json({
                success: false,
                error: 'Negocio no encontrado'
            });
        }

        // Obtener inventario (true para incluir todos, luego filtramos)
        const inventario = await sheetsService.getInventory(businessId, true);
        
        // Filtrar productos activos
        const products = inventario
            .filter(p => p.estado === 'ACTIVO')
            .map(p => ({
                id: p.codigo,
                codigo: p.codigo,
                nombre: p.nombre,
                descripcion: p.descripcion || '',
                precio: p.precio,
                imagen: p.imagenUrl || '',
                disponible: p.disponible,
                stock: p.stock,
                estado: p.disponible > 0 ? 'disponible' : 'agotado'
            }));
        
        const business = {
            id: negocio.id,
            nombre: negocio.nombre,
            descripcion: negocio.descripcion || '',
            imagen: negocio.logoUrl || '',
            tiktok: negocio.tiktokUrl || '',
            whatsapp: negocio.whatsappNumber || ''
        };
        
        res.json({
            success: true,
            business: business,
            products: products
        });
        
    } catch (error) {
        console.error('Error obteniendo productos:', error);
        res.status(500).json({
            success: false,
            error: 'Error obteniendo productos'
        });
    }
});

/**
 * POST /api/apartar
 * Registra un producto apartado en Excel del negocio y de ApartaLo
 * Luego redirige al WhatsApp de ApartaLo para continuar el flujo
 */
router.post('/api/apartar', async (req, res) => {
    try {
        const { businessId, productId, productoNombre, precio } = req.body;
        
        if (!businessId || !productId) {
            return res.status(400).json({
                success: false,
                error: 'Faltan datos requeridos'
            });
        }

        if (!sheetsService) {
            // Modo demo - redirigir a ApartaLo
            const demoMensaje = `APARTADO_WEB
Negocio: DEMO
Producto: ${productId}
Nombre: ${productoNombre || 'Producto Demo'}
Precio: ${precio || '0'}

Quiero completar mi compra`;
            
            return res.json({
                success: true,
                message: 'Producto apartado (modo demo)',
                whatsappUrl: `https://wa.me/${APARTALO_WHATSAPP}?text=${encodeURIComponent(demoMensaje)}`
            });
        }

        // Obtener negocio
        const negocio = sheetsService.getBusiness(businessId);
        
        if (!negocio) {
            return res.status(404).json({
                success: false,
                error: 'Negocio no encontrado'
            });
        }

        // Verificar producto
        const producto = await sheetsService.getProductByCode(businessId, productId);
        
        if (!producto) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

        if (producto.disponible <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Producto sin stock disponible'
            });
        }

        // 1. Reservar stock en el inventario del negocio
        await sheetsService.reserveStock(businessId, productId, 1);

        // 2. Crear pedido en la hoja del negocio
        const pedidoData = {
            whatsapp: '',
            cliente: 'Cliente Web',
            telefono: '',
            direccion: '',
            items: [{
                codigo: productId,
                nombre: productoNombre,
                cantidad: 1,
                precio: precio
            }],
            total: precio,
            observaciones: 'Apartado desde catálogo web - Pendiente datos cliente'
        };

        const result = await sheetsService.createOrder(businessId, pedidoData);

        if (!result.success) {
            // Liberar stock si falla
            await sheetsService.releaseStock(businessId, productId, 1);
            return res.status(500).json({
                success: false,
                error: 'Error creando pedido'
            });
        }

        // 3. Registrar en hoja de Pedidos de ApartaLo (si existe la función)
        try {
            if (sheetsService.registrarPedidoApartaLo) {
                await sheetsService.registrarPedidoApartaLo({
                    pedidoId: result.pedidoId,
                    businessId: businessId,
                    businessNombre: negocio.nombre,
                    productId: productId,
                    productoNombre: productoNombre,
                    precio: precio,
                    estado: 'PENDIENTE_CONTACTO',
                    origen: 'WEB_CATALOGO',
                    fecha: new Date().toISOString()
                });
            }
        } catch (e) {
            console.log('⚠️ No se pudo registrar en Pedidos ApartaLo:', e.message);
        }

        // 4. Generar URL de WhatsApp de ApartaLo con datos estructurados
        const mensaje = `APARTADO_WEB
Negocio: ${negocio.nombre}
NegocioID: ${businessId}
Producto: ${productId}
Nombre: ${productoNombre}
Precio: S/${parseFloat(precio).toFixed(2)}
PedidoID: ${result.pedidoId}

Hola! Acabo de apartar este producto desde el catálogo web. Quiero completar mi compra.`;

        const whatsappUrl = `https://wa.me/${APARTALO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;

        res.json({
            success: true,
            message: 'Producto apartado exitosamente',
            pedidoId: result.pedidoId,
            whatsappUrl: whatsappUrl
        });
        
    } catch (error) {
        console.error('Error apartando producto:', error);
        res.status(500).json({
            success: false,
            error: 'Error procesando solicitud'
        });
    }
});

module.exports = router;
