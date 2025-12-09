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

        // Filtrar productos PUBLICADOS y ACTIVOS (visible en catálogo)
        // INACTIVOS no se muestran
        const products = inventario
            .filter(p => p.estado === 'PUBLICADO' || p.estado === 'ACTIVO')
            .sort((a, b) => {
                // Primero PUBLICADOS, luego ACTIVOS
                if (a.estado === 'PUBLICADO' && b.estado !== 'PUBLICADO') return -1;
                if (a.estado !== 'PUBLICADO' && b.estado === 'PUBLICADO') return 1;
                // Dentro de cada grupo, ordenar por disponibilidad (más stock primero)
                return (b.disponible || 0) - (a.disponible || 0);
            })
            .map(p => ({
                id: p.codigo,
                codigo: p.codigo,
                nombre: p.nombre,
                descripcion: p.descripcion || '',
                precio: p.precio,
                imagen: p.imagenUrl || '',
                disponible: p.disponible,
                stock: p.stock,
                estado: p.estado // Incluir estado real para el frontend
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

module.exports = router;
