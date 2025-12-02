const express = require('express');
const router = express.Router();

/**
 * GET /api/businesses
 * Obtiene lista de negocios activos desde Google Sheets
 */
router.get('/api/businesses', async (req, res) => {
    try {
        const sheetsService = req.app.get('sheetsService');
        
        // Obtener negocios desde Google Sheets
        const businesses = await sheetsService.getBusinesses();
        
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
        const sheetsService = req.app.get('sheetsService');
        
        // Obtener info del negocio
        const business = await sheetsService.getBusinessById(businessId);
        if (!business) {
            return res.status(404).json({
                success: false,
                error: 'Negocio no encontrado'
            });
        }
        
        // Obtener productos del negocio
        const products = await sheetsService.getProductsByBusiness(businessId);
        
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
 * Registra un pedido apartado
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
        
        const sheetsService = req.app.get('sheetsService');
        
        // Verificar que el producto no esté apartado
        const product = await sheetsService.getProductById(productId);
        if (product.estado === 'apartado') {
            return res.status(400).json({
                success: false,
                error: 'Producto ya apartado'
            });
        }
        
        // Obtener info del negocio
        const business = await sheetsService.getBusinessById(businessId);
        
        // Crear registro de pedido
        const pedido = {
            fecha: new Date().toISOString(),
            businessId: businessId,
            businessNombre: business.nombre,
            productId: productId,
            productoNombre: productoNombre,
            precio: precio,
            estado: 'pendiente',
            origen: 'landing'
        };
        
        // Guardar en Google Sheets
        await sheetsService.createOrder(pedido);
        
        // Marcar producto como apartado
        await sheetsService.updateProductStatus(productId, 'apartado');
        
        // Generar URL de WhatsApp
        const whatsappUrl = generateWhatsAppUrl(business, productoNombre, precio);
        
        res.json({
            success: true,
            message: 'Producto apartado exitosamente',
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
 * Genera URL de WhatsApp con mensaje pre-llenado
 */
function generateWhatsAppUrl(business, productoNombre, precio) {
    const phoneNumber = business.telefono || business.whatsapp;
    
    if (!phoneNumber) {
        return null;
    }
    
    // Limpiar número (solo dígitos)
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    // Mensaje pre-llenado
    const message = `¡Hola! Acabo de apartar el siguiente producto en ApartaLo:

📦 *${productoNombre}*
💰 Precio: S/${precio}

Me gustaría completar la compra. ¿Cuáles son los siguientes pasos?`;
    
    // Codificar mensaje
    const encodedMessage = encodeURIComponent(message);
    
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

module.exports = router;
