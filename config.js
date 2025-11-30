/**
 * Configuration Module for ApartaLo Bot
 * Multi-tenant WhatsApp Bot for Live Sales
 */

const dotenv = require('dotenv');
dotenv.config();

module.exports = {
    whatsapp: {
        token: process.env.WHATSAPP_TOKEN,
        phoneId: process.env.WHATSAPP_PHONE_ID,
        verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'LIVE_COMMERCE_2024',
        apiVersion: process.env.WHATSAPP_API_VERSION || 'v24.0',
        apiUrl: 'https://graph.facebook.com'
    },
    
    sheets: {
        // Credenciales de Google Service Account (JSON string)
        credentials: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
        
        // Spreadsheet MAESTRO con lista de negocios
        masterSpreadsheetId: process.env.MASTER_SPREADSHEET_ID
    },
    
    platform: {
        name: process.env.PLATFORM_NAME || 'ApartaLo',
        supportPhone: process.env.SUPPORT_PHONE || '',
        supportEmail: process.env.SUPPORT_EMAIL || ''
    },
    
    app: {
        port: process.env.PORT || 3000,
        isDevelopment: process.env.NODE_ENV !== 'production',
        timezone: 'America/Lima'
    },
    
    // Configuracion de reservas
    reservations: {
        // Sin tiempo automatico - liberacion manual
        autoExpire: false,
        defaultStatus: 'RESERVADO'
    }
};
