/**
 * APARTALO BOT
 * Bot multi-negocio para ventas por WhatsApp en lives
 * 
 * Version: 1.2.0
 */

const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const config = require('./config');
const sheetsService = require('./sheets-service');
const stateManager = require('./state-manager');
const webhookRoute = require('./webhook');
const adminRoutes = require('./admin-routes');
const landingApi = require('./landing-api');

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '10mb' }));

// ========================================
// ARCHIVOS ESTATICOS (PWA)
// ========================================
app.use(express.static(path.join(__dirname, 'public')));

// ========================================
// RUTAS PRINCIPALES
// ========================================

app.get('/', (req, res) => {
    const stats = stateManager.getStats();
    const businesses = sheetsService.getBusinesses();
    
    res.json({
        status: 'active',
        service: 'ApartaLo Bot',
        version: '1.2.0',
        platform: config.platform.name,
        stats: {
            activeSessions: stats.activeSessions,
            activeCarts: stats.activeCarts,
            totalSubscriptions: stats.totalSubscriptions,
            registeredBusinesses: businesses.length
        },
        businesses: businesses.map(b => ({
            id: b.id,
            nombre: b.nombre,
            prefijo: b.prefijo
        })),
        endpoints: {
            webhook: '/webhook',
            health: '/health',
            api: '/api',
            admin: '/admin'
        }
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        sheetsConnected: sheetsService.initialized
    });
});

// ========================================
// PANEL DE ADMIN (PWA)
// ========================================
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ========================================
// RUTAS DE WEBHOOK (WhatsApp)
// ========================================
app.use('/webhook', webhookRoute);

// ========================================
// RUTAS DE LANDING API (para el frontend público)
// ========================================
app.use(landingApi);

// ========================================
// RUTAS DE ADMIN API
// ========================================
app.use('/api', adminRoutes);

// ========================================
// DOCUMENTACION DE API
// ========================================
app.get('/api', (req, res) => {
    res.json({
        name: 'ApartaLo Admin API',
        version: '1.2.0',
        endpoints: {
            negocios: {
                'GET /api/negocios': 'Listar todos los negocios',
                'GET /api/negocios/:id': 'Obtener un negocio',
                'POST /api/negocios/reload': 'Recargar negocios desde Sheets'
            },
            productos: {
                'GET /api/:businessId/productos': 'Listar productos (query: estado, disponible)',
                'GET /api/:businessId/productos/:codigo': 'Obtener un producto',
                'POST /api/:businessId/productos': 'Crear producto',
                'PUT /api/:businessId/productos/:codigo': 'Actualizar producto',
                'PUT /api/:businessId/productos/:codigo/stock': 'Actualizar stock',
                'DELETE /api/:businessId/productos/:codigo': 'Desactivar producto',
                'POST /api/:businessId/productos/:codigo/liberar': 'Liberar stock reservado'
            },
            pedidos: {
                'GET /api/:businessId/pedidos': 'Listar pedidos (query: estado, fecha, limit)',
                'GET /api/:businessId/pedidos/stats': 'Estadísticas de pedidos',
                'GET /api/:businessId/pedidos/:id': 'Obtener un pedido',
                'PUT /api/:businessId/pedidos/:id/estado': 'Actualizar estado',
                'POST /api/:businessId/pedidos/:id/cancelar': 'Cancelar pedido y liberar stock'
            },
            clientes: {
                'GET /api/:businessId/clientes': 'Listar clientes',
                'GET /api/:businessId/clientes/:whatsapp': 'Buscar cliente con historial'
            }
        },
        estados_pedido: [
            'PENDIENTE_PAGO',
            'PENDIENTE_VALIDACION',
            'CONFIRMADO',
            'EN_PREPARACION',
            'ENVIADO',
            'ENTREGADO',
            'CANCELADO'
        ]
    });
});

// ========================================
// ERROR HANDLERS
// ========================================

app.use((error, req, res, next) => {
    console.error('❌ Error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: config.app.isDevelopment ? error.message : 'Something went wrong'
    });
});

app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.url}`
    });
});

// ========================================
// INICIALIZACION
// ========================================

async function initializeApp() {
    try {
        console.log('\n🚀 Iniciando ApartaLo Bot v1.2...\n');
        
        const sheetsReady = await sheetsService.initialize();
        
        const PORT = config.app.port;
        
        app.listen(PORT, () => {
            console.log(`
╔════════════════════════════════════════════════════╗
║       🛍️  APARTALO BOT v1.2 INICIADO  🛍️          ║
║          Bot Multi-Negocio para Lives              ║
╠════════════════════════════════════════════════════╣
║  📍 Puerto: ${PORT.toString().padEnd(39)}║
║  🌐 URL: http://localhost:${PORT.toString().padEnd(23)}║
║  📱 Webhook: /webhook                              ║
║  🔧 Admin API: /api                                ║
║  📊 Admin Panel: /admin                            ║
║  💚 Health: /health                                ║
║  ⚙️  Modo: ${config.app.isDevelopment ? '🔧 DESARROLLO' : '✅ PRODUCCION'}                        ║
╠════════════════════════════════════════════════════╣
║  🔌 Servicios:                                     ║
║  ${sheetsReady ? '✅' : '❌'} Google Sheets                              ║
║  ${config.whatsapp.token ? '✅' : '❌'} WhatsApp Cloud API                        ║
╠════════════════════════════════════════════════════╣
║  📦 Negocios registrados: ${sheetsService.getBusinesses().length.toString().padEnd(24)}║
╚════════════════════════════════════════════════════╝
            `);
            
            if (sheetsReady) {
                const negocios = sheetsService.getBusinesses();
                console.log('📋 Negocios disponibles:');
                negocios.forEach(n => {
                    console.log(`   • ${n.nombre} (${n.prefijo})`);
                });
            }
            
            console.log('\n');
        });
        
    } catch (error) {
        console.error('❌ Error fatal iniciando la aplicacion:', error);
        process.exit(1);
    }
}

setInterval(() => {
    stateManager.cleanupInactiveSessions();
}, 10 * 60 * 1000);

process.on('SIGTERM', () => {
    console.log('\n🔄 SIGTERM recibido, cerrando servidor...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n🔄 SIGINT recibido, cerrando servidor...');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Rejection:', error);
    process.exit(1);
});

initializeApp();

module.exports = app;
