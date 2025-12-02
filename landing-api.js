/**
 * Landing API Routes
 * Rutas específicas para el nuevo landing tipo TikTok
 */

const express = require('express');
const router = express.Router();

// Importar servicios (ajustar paths según tu estructura)
let sheetsService, liveManager;

try {
    sheetsService = require('./sheets-service');
    liveManager = require('./live-manager');
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
            descripcion: n.descripcion || 'Productos únicos en vivo',
            imagen: n.logoUrl || '',
            telefono: n.whatsappNumber || '',
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
                business: { id: businessId, nombre: 'Demo', imagen: '', tiktok: '', telefono: '' },
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

        // Obtener inventario
        const inventario = await sheetsService.getInventory(businessId);
        
        // Filtrar solo productos activos con stock
        const products = inventario
            .filter(p => p.estado === 'ACTIVO' && p.disponible > 0)
            .map(p => ({
                id: p.codigo,
                codigo: p.codigo,
                nombre: p.nombre,
                descripcion: p.descripcion || 'Producto único disponible',
                precio: p.precio,
                imagen: p.imagenUrl || '',
                estado: 'disponible' // Siempre disponible por ahora
            }));
        
        const business = {
            id: negocio.id,
            nombre: negocio.nombre,
            imagen: negocio.logoUrl || '',
            tiktok: negocio.tiktokUrl || '',
            telefono: negocio.whatsappNumber || ''
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
            // Mock para desarrollo
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

        // Verificar que el producto exista
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
                error: 'Producto sin stock'
            });
        }

        // Crear pedido simplificado
        const pedidoData = {
            whatsapp: '',
            cliente: 'Cliente Landing',
            telefono: '',
            direccion: '',
            items: [{
                codigo: productId,
                nombre: productoNombre,
                cantidad: 1,
                precio: precio
            }],
            total: precio,
            observaciones: 'Apartado desde landing web'
        };

        const result = await sheetsService.createOrder(businessId, pedidoData);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error creando pedido'
            });
        }

        // Generar URL de WhatsApp
        const phoneNumber = negocio.whatsappNumber;
        const mensaje = `¡Hola! Acabo de apartar el siguiente producto en ApartaLo:

📦 *${productoNombre}*
💰 Precio: S/${precio}
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
    
    // Limpiar número (solo dígitos)
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    // Codificar mensaje
    const encodedMessage = encodeURIComponent(mensaje);
    
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

module.exports = router;
