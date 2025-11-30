/**
 * APARTALO BOT
 * Bot multi-negocio para ventas por WhatsApp en lives
 * 
 * Version: 1.0.0
 */

const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const config = require('./config');
const sheetsService = require('./sheets-service');
const stateManager = require('./state-manager');
const webhookRoute = require('./webhook');

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get('/', (req, res) => {
    const stats = stateManager.getStats();
    const businesses = sheetsService.getBusinesses();
    
    res.json({
        status: 'active',
        service: 'ApartaLo Bot',
        version: '1.0.0',
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
            health: '/health'
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

app.use('/webhook', webhookRoute);

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

async function initializeApp() {
    try {
        console.log('\n🚀 Iniciando ApartaLo Bot v1.0...\n');
        
        const sheetsReady = await sheetsService.initialize();
        
        const PORT = config.app.port;
        
        app.listen(PORT, () => {
            console.log(`
╔════════════════════════════════════════════════════╗
║       🛍️  APARTALO BOT v1.0 INICIADO  🛍️          ║
║          Bot Multi-Negocio para Lives              ║
╠════════════════════════════════════════════════════╣
║  📍 Puerto: ${PORT.toString().padEnd(39)}║
║  🌐 URL: http://localhost:${PORT.toString().padEnd(23)}║
║  📱 Webhook: /webhook                              ║
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
