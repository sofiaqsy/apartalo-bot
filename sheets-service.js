/**
 * Google Sheets Service - Multi-tenant
 * Maneja la conexion a multiples spreadsheets (uno por negocio)
 */

const { google } = require('googleapis');
const config = require('./config');

class SheetsService {
    constructor() {
        this.sheets = null;
        this.auth = null;
        this.initialized = false;
        this.businessCache = new Map();
    }
    
    async initialize() {
        try {
            const credentialsJson = config.sheets.credentials;
            const masterSpreadsheetId = config.sheets.masterSpreadsheetId;
            
            if (!credentialsJson || !masterSpreadsheetId) {
                console.log('⚠️ Google Sheets no configurado');
                return false;
            }
            
            let credentials;
            try {
                credentials = JSON.parse(credentialsJson);
            } catch (error) {
                console.error('❌ Error parseando GOOGLE_SERVICE_ACCOUNT_KEY:', error.message);
                return false;
            }
            
            this.auth = new google.auth.GoogleAuth({
                credentials: credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });
            
            this.sheets = google.sheets({ version: 'v4', auth: this.auth });
            this.masterSpreadsheetId = masterSpreadsheetId;
            
            await this.loadBusinesses();
            
            this.initialized = true;
            console.log('✅ Google Sheets Service inicializado');
            console.log(`   Negocios cargados: ${this.businessCache.size}`);
            
            return true;
        } catch (error) {
            console.error('❌ Error inicializando Google Sheets:', error.message);
            return false;
        }
    }
    
    // ========================================
    // GESTION DE NEGOCIOS (MAESTRO)
    // ========================================
    
    async loadBusinesses() {
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.masterSpreadsheetId,
                range: 'Negocios!A:G'
            });
            
            const rows = response.data.values || [];
            this.businessCache.clear();
            
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const estado = (row[6] || 'ACTIVO').toUpperCase();
                
                if (estado === 'ACTIVO') {
                    const business = {
                        id: row[0] || '',
                        nombre: row[1] || '',
                        prefijo: row[2] || '',
                        spreadsheetId: row[3] || '',
                        descripcion: row[4] || '',
                        logoUrl: row[5] || '',
                        estado: estado
                    };
                    
                    this.businessCache.set(business.id, business);
                    console.log(`   📦 ${business.nombre} (${business.prefijo})`);
                }
            }
            
            return Array.from(this.businessCache.values());
        } catch (error) {
            console.error('❌ Error cargando negocios:', error.message);
            return [];
        }
    }
    
    getBusinesses() {
        return Array.from(this.businessCache.values());
    }
    
    getBusiness(businessId) {
        return this.businessCache.get(businessId);
    }
    
    getBusinessByPrefix(prefix) {
        for (const business of this.businessCache.values()) {
            if (business.prefijo.toUpperCase() === prefix.toUpperCase()) {
                return business;
            }
        }
        return null;
    }
    
    // ========================================
    // INVENTARIO POR NEGOCIO
    // ========================================
    
    async getInventory(businessId) {
        const business = this.getBusiness(businessId);
        if (!business || !business.spreadsheetId) {
            return [];
        }
        
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: business.spreadsheetId,
                range: 'Inventario!A:H'
            });
            
            const rows = response.data.values || [];
            const productos = [];
            
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const estado = (row[7] || 'ACTIVO').toUpperCase();
                const stock = parseInt(row[4]) || 0;
                const stockReservado = parseInt(row[5]) || 0;
                const disponible = stock - stockReservado;
                
                if (estado === 'ACTIVO' && disponible > 0) {
                    productos.push({
                        codigo: row[0] || '',
                        nombre: row[1] || '',
                        descripcion: row[2] || '',
                        precio: parseFloat(row[3]) || 0,
                        stock: stock,
                        stockReservado: stockReservado,
                        disponible: disponible,
                        imagenUrl: row[6] || '',
                        estado: estado,
                        rowIndex: i + 1
                    });
                }
            }
            
            return productos;
            
        } catch (error) {
            console.error(`❌ Error obteniendo inventario:`, error.message);
            return [];
        }
    }
    
    async getProductByCode(businessId, codigo) {
        const inventory = await this.getInventory(businessId);
        return inventory.find(p => p.codigo.toUpperCase() === codigo.toUpperCase());
    }
    
    async reserveStock(businessId, codigo, cantidad) {
        const business = this.getBusiness(businessId);
        if (!business) return { success: false, error: 'Negocio no encontrado' };
        
        try {
            const producto = await this.getProductByCode(businessId, codigo);
            if (!producto) {
                return { success: false, error: 'Producto no encontrado' };
            }
            
            if (producto.disponible < cantidad) {
                return { 
                    success: false, 
                    error: `Stock insuficiente. Disponible: ${producto.disponible}` 
                };
            }
            
            const nuevoReservado = producto.stockReservado + cantidad;
            
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: business.spreadsheetId,
                range: `Inventario!F${producto.rowIndex}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [[nuevoReservado]] }
            });
            
            console.log(`✅ Reservado: ${cantidad} x ${producto.nombre}`);
            return { success: true, producto, cantidadReservada: cantidad };
            
        } catch (error) {
            console.error('❌ Error reservando stock:', error.message);
            return { success: false, error: error.message };
        }
    }
    
    async releaseStock(businessId, codigo, cantidad) {
        const business = this.getBusiness(businessId);
        if (!business) return { success: false };
        
        try {
            const producto = await this.getProductByCode(businessId, codigo);
            if (!producto) return { success: false };
            
            const nuevoReservado = Math.max(0, producto.stockReservado - cantidad);
            
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: business.spreadsheetId,
                range: `Inventario!F${producto.rowIndex}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [[nuevoReservado]] }
            });
            
            console.log(`🔓 Liberado: ${cantidad} x ${producto.nombre}`);
            return { success: true };
            
        } catch (error) {
            console.error('❌ Error liberando stock:', error.message);
            return { success: false };
        }
    }
    
    // ========================================
    // PEDIDOS POR NEGOCIO
    // ========================================
    
    async createOrder(businessId, orderData) {
        const business = this.getBusiness(businessId);
        if (!business) return { success: false, error: 'Negocio no encontrado' };
        
        try {
            const pedidoId = `${business.prefijo}-${Date.now().toString().slice(-6)}`;
            const fecha = new Date();
            
            const productosStr = orderData.items.map(item => 
                `${item.codigo}:${item.nombre}:${item.cantidad}:${item.precio}`
            ).join('|');
            
            const valores = [[
                pedidoId,
                fecha.toLocaleDateString('es-PE'),
                fecha.toLocaleTimeString('es-PE'),
                orderData.whatsapp || '',
                orderData.cliente || '',
                orderData.telefono || '',
                orderData.direccion || '',
                productosStr,
                orderData.total || 0,
                'PENDIENTE_PAGO',
                '',
                orderData.observaciones || ''
            ]];
            
            await this.sheets.spreadsheets.values.append({
                spreadsheetId: business.spreadsheetId,
                range: 'Pedidos!A:L',
                valueInputOption: 'USER_ENTERED',
                resource: { values: valores }
            });
            
            console.log(`✅ Pedido creado: ${pedidoId}`);
            return { success: true, pedidoId };
            
        } catch (error) {
            console.error('❌ Error creando pedido:', error.message);
            return { success: false, error: error.message };
        }
    }
    
    async getOrdersByClient(businessId, whatsapp) {
        const business = this.getBusiness(businessId);
        if (!business) return [];
        
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: business.spreadsheetId,
                range: 'Pedidos!A:L'
            });
            
            const rows = response.data.values || [];
            const pedidos = [];
            const whatsappLimpio = whatsapp.replace(/[^0-9]/g, '');
            
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const whatsappPedido = (row[3] || '').replace(/[^0-9]/g, '');
                
                if (whatsappPedido.includes(whatsappLimpio) || whatsappLimpio.includes(whatsappPedido)) {
                    pedidos.push({
                        id: row[0],
                        fecha: row[1],
                        hora: row[2],
                        whatsapp: row[3],
                        cliente: row[4],
                        telefono: row[5],
                        direccion: row[6],
                        productos: row[7],
                        total: parseFloat(row[8]) || 0,
                        estado: row[9],
                        voucherUrl: row[10],
                        observaciones: row[11],
                        rowIndex: i + 1
                    });
                }
            }
            
            return pedidos;
            
        } catch (error) {
            console.error('❌ Error obteniendo pedidos:', error.message);
            return [];
        }
    }
    
    async updateOrderStatus(businessId, pedidoId, nuevoEstado, voucherUrl = null) {
        const business = this.getBusiness(businessId);
        if (!business) return { success: false };
        
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: business.spreadsheetId,
                range: 'Pedidos!A:L'
            });
            
            const rows = response.data.values || [];
            
            for (let i = 1; i < rows.length; i++) {
                if (rows[i][0] === pedidoId) {
                    const updates = [
                        {
                            range: `Pedidos!J${i + 1}`,
                            values: [[nuevoEstado]]
                        }
                    ];
                    
                    if (voucherUrl) {
                        updates.push({
                            range: `Pedidos!K${i + 1}`,
                            values: [[voucherUrl]]
                        });
                    }
                    
                    await this.sheets.spreadsheets.values.batchUpdate({
                        spreadsheetId: business.spreadsheetId,
                        resource: {
                            data: updates,
                            valueInputOption: 'USER_ENTERED'
                        }
                    });
                    
                    console.log(`✅ Pedido ${pedidoId} actualizado: ${nuevoEstado}`);
                    return { success: true };
                }
            }
            
            return { success: false, error: 'Pedido no encontrado' };
            
        } catch (error) {
            console.error('❌ Error actualizando pedido:', error.message);
            return { success: false, error: error.message };
        }
    }
    
    // ========================================
    // CLIENTES POR NEGOCIO
    // ========================================
    
    async findClient(businessId, whatsapp) {
        const business = this.getBusiness(businessId);
        if (!business) return null;
        
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: business.spreadsheetId,
                range: 'Clientes!A:G'
            });
            
            const rows = response.data.values || [];
            const whatsappLimpio = whatsapp.replace(/[^0-9]/g, '');
            
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const whatsappCliente = (row[1] || '').replace(/[^0-9]/g, '');
                
                if (whatsappCliente.includes(whatsappLimpio) || whatsappLimpio.includes(whatsappCliente)) {
                    return {
                        id: row[0],
                        whatsapp: row[1],
                        nombre: row[2],
                        telefono: row[3],
                        direccion: row[4],
                        fechaRegistro: row[5],
                        ultimaCompra: row[6],
                        rowIndex: i + 1
                    };
                }
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ Error buscando cliente:', error.message);
            return null;
        }
    }
    
    async saveClient(businessId, clientData) {
        const business = this.getBusiness(businessId);
        if (!business) return { success: false };
        
        try {
            const existingClient = await this.findClient(businessId, clientData.whatsapp);
            
            if (existingClient) {
                const updates = [];
                
                if (clientData.nombre) {
                    updates.push({
                        range: `Clientes!C${existingClient.rowIndex}`,
                        values: [[clientData.nombre]]
                    });
                }
                if (clientData.telefono) {
                    updates.push({
                        range: `Clientes!D${existingClient.rowIndex}`,
                        values: [[clientData.telefono]]
                    });
                }
                if (clientData.direccion) {
                    updates.push({
                        range: `Clientes!E${existingClient.rowIndex}`,
                        values: [[clientData.direccion]]
                    });
                }
                updates.push({
                    range: `Clientes!G${existingClient.rowIndex}`,
                    values: [[new Date().toLocaleDateString('es-PE')]]
                });
                
                if (updates.length > 0) {
                    await this.sheets.spreadsheets.values.batchUpdate({
                        spreadsheetId: business.spreadsheetId,
                        resource: {
                            data: updates,
                            valueInputOption: 'USER_ENTERED'
                        }
                    });
                }
                
                return { success: true, clientId: existingClient.id, isNew: false };
                
            } else {
                const clientId = `CLI-${Date.now().toString().slice(-6)}`;
                const fecha = new Date().toLocaleDateString('es-PE');
                
                const valores = [[
                    clientId,
                    clientData.whatsapp || '',
                    clientData.nombre || '',
                    clientData.telefono || '',
                    clientData.direccion || '',
                    fecha,
                    fecha
                ]];
                
                await this.sheets.spreadsheets.values.append({
                    spreadsheetId: business.spreadsheetId,
                    range: 'Clientes!A:G',
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: valores }
                });
                
                return { success: true, clientId, isNew: true };
            }
            
        } catch (error) {
            console.error('❌ Error guardando cliente:', error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new SheetsService();
