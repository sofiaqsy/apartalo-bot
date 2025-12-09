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
 * Registra un producto apartado
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
            return res.json({
                success: true,
                message: 'Producto apartado (modo demo)',
                whatsappUrl: `https://wa.me/51999999999?text=${encodeURIComponent('Demo apartado')}`
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

        // Reservar stock
        await sheetsService.reserveStock(businessId, productId, 1);

        // Crear pedido
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
            observaciones: 'Apartado desde catálogo web'
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

        // Generar URL de WhatsApp
        const phoneNumber = negocio.whatsappNumber;
        const mensaje = `¡Hola! Acabo de apartar el siguiente producto:

📦 *${productoNombre}*
💰 Precio: S/${parseFloat(precio).toFixed(2)}
🆔 Pedido: ${result.pedidoId}

Me gustaría completar la compra. ¿Cuáles son los siguientes pasos?`;

        const whatsappUrl = generarWhatsAppUrl(phoneNumber, mensaje);

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

/**
 * Helper: Generar URL de WhatsApp
 */
function generarWhatsAppUrl(phoneNumber, mensaje) {
    if (!phoneNumber) {
        return null;
    }
    
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(mensaje);
    
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

module.exports = router;
