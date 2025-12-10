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
        this.whatsappToBusinessMap = new Map(); // Mapeo número WhatsApp -> businessId
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
                scopes: [
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/drive.file'
                ]
            });

            this.sheets = google.sheets({ version: 'v4', auth: this.auth });
            this.drive = google.drive({ version: 'v3', auth: this.auth });
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
            // Rango extendido para incluir columna I (cuentasBancarias)
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.masterSpreadsheetId,
                range: 'Negocios!A:I'
            });

            const rows = response.data.values || [];
            this.businessCache.clear();
            this.whatsappToBusinessMap.clear();

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const estado = (row[6] || 'ACTIVO').toUpperCase();

                if (estado === 'ACTIVO') {
                    const whatsappNumber = (row[7] || '').replace(/[^0-9]/g, '');
                    const cuentasBancarias = row[8] || '';

                    const business = {
                        id: row[0] || '',
                        nombre: row[1] || '',
                        prefijo: row[2] || '',
                        spreadsheetId: row[3] || '',
                        descripcion: row[4] || '',
                        logoUrl: row[5] || '',
                        estado: estado,
                        whatsappNumber: whatsappNumber,
                        cuentasBancarias: cuentasBancarias
                    };

                    this.businessCache.set(business.id, business);

                    // Mapear número de WhatsApp al negocio
                    if (whatsappNumber) {
                        this.whatsappToBusinessMap.set(whatsappNumber, business.id);
                        console.log(`   📦 ${business.nombre} (${business.prefijo}) - WhatsApp: ${whatsappNumber}`);
                    } else {
                        console.log(`   📦 ${business.nombre} (${business.prefijo})`);
                    }
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

    /**
     * Obtener negocio por número de WhatsApp del bot
     * @param {string} phoneNumberId - ID del número de teléfono de WhatsApp
     * @returns {Object|null} - Negocio asociado o null
     */
    getBusinessByWhatsappNumber(phoneNumber) {
        const cleanNumber = (phoneNumber || '').replace(/[^0-9]/g, '');
        const businessId = this.whatsappToBusinessMap.get(cleanNumber);
        return businessId ? this.getBusiness(businessId) : null;
    }

    /**
     * Obtener negocio por Phone Number ID de la API de WhatsApp
     * @param {string} phoneNumberId - Phone Number ID de WhatsApp Cloud API
     * @returns {Object|null} - Negocio asociado o null
     */
    getBusinessByPhoneNumberId(phoneNumberId) {
        // Buscar en los negocios por el Phone Number ID almacenado
        for (const business of this.businessCache.values()) {
            if (business.whatsappNumber === phoneNumberId) {
                return business;
            }
        }
        return null;
    }

    // ========================================
    // INVENTARIO POR NEGOCIO
    // ========================================

    async getInventory(businessId, includeAll = false) {
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
                if (!row[0]) continue; // Skip empty rows

                const estado = (row[7] || 'ACTIVO').toUpperCase();
                const stock = parseInt(row[4]) || 0;
                const stockReservado = parseInt(row[5]) || 0;
                const disponible = stock - stockReservado;

                // Para el bot, solo productos activos con stock
                // Para admin (includeAll), todos los productos
                if (includeAll || (estado === 'ACTIVO' && disponible > 0)) {
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
        const inventory = await this.getInventory(businessId, true);
        return inventory.find(p => p.codigo.toUpperCase() === codigo.toUpperCase());
    }

    // Genera el siguiente código de producto: PREFIJO + número secuencial
    async generateProductCode(businessId) {
        const business = this.getBusiness(businessId);
        if (!business) return null;

        const prefijo = business.prefijo;
        const productos = await this.getInventory(businessId, true);

        // Encontrar el número más alto existente
        let maxNum = 0;
        for (const p of productos) {
            const match = p.codigo.match(new RegExp(`^${prefijo}(\\d+)$`, 'i'));
            if (match) {
                const num = parseInt(match[1]);
                if (num > maxNum) maxNum = num;
            }
        }

        // Generar nuevo código con padding de 2 dígitos
        const nextNum = maxNum + 1;
        const codigo = `${prefijo}${nextNum.toString().padStart(2, '0')}`;

        return codigo;
    }

    async createProduct(businessId, productData) {
        const business = this.getBusiness(businessId);
        if (!business) return { success: false, error: 'Negocio no encontrado' };

        try {
            // Autogenerar código si no viene
            let codigo = productData.codigo;
            if (!codigo) {
                codigo = await this.generateProductCode(businessId);
                if (!codigo) {
                    return { success: false, error: 'Error generando código de producto' };
                }
            }

            // Verificar si ya existe
            const existing = await this.getProductByCode(businessId, codigo);
            if (existing) {
                return { success: false, error: 'Ya existe un producto con ese código' };
            }

            const valores = [[
                codigo,
                productData.nombre,
                productData.descripcion || '',
                productData.precio,
                productData.stock,
                0, // StockReservado inicial
                productData.imagenUrl || '',
                productData.estado || 'ACTIVO'
            ]];

            await this.sheets.spreadsheets.values.append({
                spreadsheetId: business.spreadsheetId,
                range: 'Inventario!A:H',
                valueInputOption: 'USER_ENTERED',
                resource: { values: valores }
            });

            console.log(`✅ Producto creado: ${codigo}`);
            return { success: true, codigo };

        } catch (error) {
            console.error('❌ Error creando producto:', error.message);
            return { success: false, error: error.message };
        }
    }

    async updateProduct(businessId, codigo, updates) {
        const business = this.getBusiness(businessId);
        if (!business) return { success: false, error: 'Negocio no encontrado' };

        try {
            const producto = await this.getProductByCode(businessId, codigo);
            if (!producto) {
                return { success: false, error: 'Producto no encontrado' };
            }

            const batchUpdates = [];
            const rowIndex = producto.rowIndex;

            if (updates.nombre !== undefined) {
                batchUpdates.push({ range: `Inventario!B${rowIndex}`, values: [[updates.nombre]] });
            }
            if (updates.descripcion !== undefined) {
                batchUpdates.push({ range: `Inventario!C${rowIndex}`, values: [[updates.descripcion]] });
            }
            if (updates.precio !== undefined) {
                batchUpdates.push({ range: `Inventario!D${rowIndex}`, values: [[updates.precio]] });
            }
            if (updates.stock !== undefined) {
                batchUpdates.push({ range: `Inventario!E${rowIndex}`, values: [[updates.stock]] });
            }
            if (updates.stockReservado !== undefined) {
                batchUpdates.push({ range: `Inventario!F${rowIndex}`, values: [[updates.stockReservado]] });
            }
            if (updates.imagenUrl !== undefined) {
                batchUpdates.push({ range: `Inventario!G${rowIndex}`, values: [[updates.imagenUrl]] });
            }
            if (updates.estado !== undefined) {
                batchUpdates.push({ range: `Inventario!H${rowIndex}`, values: [[updates.estado]] });
            }

            if (batchUpdates.length > 0) {
                await this.sheets.spreadsheets.values.batchUpdate({
                    spreadsheetId: business.spreadsheetId,
                    resource: {
                        data: batchUpdates,
                        valueInputOption: 'USER_ENTERED'
                    }
                });
            }

            console.log(`✅ Producto actualizado: ${codigo}`);
            return { success: true, codigo };

        } catch (error) {
            console.error('❌ Error actualizando producto:', error.message);
            return { success: false, error: error.message };
        }
    }

    async updateProductStock(businessId, codigo, stockData) {
        const updates = {};
        if (stockData.stock !== undefined) updates.stock = stockData.stock;
        if (stockData.stockReservado !== undefined) updates.stockReservado = stockData.stockReservado;
        return await this.updateProduct(businessId, codigo, updates);
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
            if (!producto) return { success: false, error: 'Producto no encontrado' };

            const nuevoReservado = Math.max(0, producto.stockReservado - cantidad);

            await this.sheets.spreadsheets.values.update({
                spreadsheetId: business.spreadsheetId,
                range: `Inventario!F${producto.rowIndex}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [[nuevoReservado]] }
            });

            console.log(`🔓 Liberado: ${cantidad} x ${producto.nombre}`);
            return { success: true, liberado: cantidad, nuevoReservado };

        } catch (error) {
            console.error('❌ Error liberando stock:', error.message);
            return { success: false, error: error.message };
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
                orderData.observaciones || '',
                '', // Departamento
                '', // Ciudad
                '', // Tipo Envio
                '', // Metodo Envio
                '', // Detalle Envio
                ''  // Costo Envio
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

    parseItems(itemsStr) {
        if (!itemsStr) return [];

        try {
            return itemsStr.split('|').map(itemStr => {
                const parts = itemStr.split(':');
                if (parts.length < 4) return null;

                const cantidad = parseInt(parts[2]) || 0;
                const precio = parseFloat(parts[3]) || 0;

                return {
                    codigo: parts[0],
                    nombre: parts[1],
                    cantidad: cantidad,
                    precio: precio,
                    subtotal: cantidad * precio
                };
            }).filter(item => item !== null);
        } catch (e) {
            console.error('Error parsing items:', e);
            return [];
        }
    }

    async getAllOrders(businessId) {
        const business = this.getBusiness(businessId);
        if (!business) return [];

        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: business.spreadsheetId,
                range: 'Pedidos!A:R'
            });

            const rows = response.data.values || [];
            const pedidos = [];

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row[0]) continue;

                pedidos.push({
                    id: row[0],
                    fecha: row[1],
                    hora: row[2],
                    whatsapp: row[3],
                    cliente: row[4],
                    telefono: row[5],
                    direccion: row[6],
                    items: this.parseItems(row[7]),
                    total: parseFloat(row[8] || 0),
                    estado: row[9],
                    voucherUrl: row[10],
                    observaciones: row[11],
                    // Nuevas columnas de envío
                    departamento: row[12] || '',
                    ciudad: row[13] || '',
                    tipoEnvio: row[14] || '',
                    metodoEnvio: row[15] || '',
                    detalleEnvio: row[16] || '',
                    costoEnvio: parseFloat(row[17] || 0),
                    rowIndex: i + 1
                });
            }

            // Ordenar por fecha descendente (más recientes primero)
            return pedidos.reverse();

        } catch (error) {
            console.error('❌ Error obteniendo pedidos:', error.message);
            return [];
        }
    }

    async getOrderById(businessId, pedidoId) {
        const pedidos = await this.getAllOrders(businessId);
        return pedidos.find(p => p.id === pedidoId);
    }

    async getOrdersByClient(businessId, whatsapp) {
        const business = this.getBusiness(businessId);
        if (!business) return [];

        try {
            const pedidos = await this.getAllOrders(businessId);
            const whatsappLimpio = whatsapp.replace(/[^0-9]/g, '');

            return pedidos.filter(p => {
                const whatsappPedido = (p.whatsapp || '').replace(/[^0-9]/g, '');
                return whatsappPedido.includes(whatsappLimpio) || whatsappLimpio.includes(whatsappPedido);
            });

        } catch (error) {
            console.error('❌ Error obteniendo pedidos:', error.message);
            return [];
        }
    }

    async updateOrderStatus(businessId, pedidoId, nuevoEstado, voucherUrl = null) {
        const business = this.getBusiness(businessId);
        if (!business) return { success: false };

        try {
            const pedido = await this.getOrderById(businessId, pedidoId);
            if (!pedido) {
                return { success: false, error: 'Pedido no encontrado' };
            }

            const updates = [
                { range: `Pedidos!J${pedido.rowIndex}`, values: [[nuevoEstado]] }
            ];

            if (voucherUrl) {
                // Agregar el nuevo voucher a la lista existente
                const existingVouchers = pedido.voucherUrl ? pedido.voucherUrl.split('|').filter(v => v) : [];
                existingVouchers.push(voucherUrl);
                const allVouchers = existingVouchers.join('|');

                updates.push({ range: `Pedidos!K${pedido.rowIndex}`, values: [[allVouchers]] });
            }

            await this.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: business.spreadsheetId,
                resource: {
                    data: updates,
                    valueInputOption: 'USER_ENTERED'
                }
            });

            console.log(`✅ Pedido ${pedidoId} actualizado: ${nuevoEstado}`);
            return { success: true, pedidoId, estado: nuevoEstado };

        } catch (error) {
            console.error('❌ Error actualizando pedido:', error.message);
            return { success: false, error: error.message };
        }
    }

    async updateOrderObservations(businessId, pedidoId, observaciones) {
        const business = this.getBusiness(businessId);
        if (!business) return { success: false };

        try {
            const pedido = await this.getOrderById(businessId, pedidoId);
            if (!pedido) {
                return { success: false, error: 'Pedido no encontrado' };
            }

            await this.sheets.spreadsheets.values.update({
                spreadsheetId: business.spreadsheetId,
                range: `Pedidos!L${pedido.rowIndex}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [[observaciones]] }
            });

            return { success: true };

        } catch (error) {
            console.error('❌ Error actualizando observaciones:', error.message);
            return { success: false, error: error.message };
        }
    }

    async addProductToOrder(businessId, pedidoId, newItem) {
        const business = this.getBusiness(businessId);
        if (!business) return { success: false, error: 'Negocio no encontrado' };

        try {
            const pedido = await this.getOrderById(businessId, pedidoId);
            if (!pedido) {
                return { success: false, error: 'Pedido no encontrado' };
            }

            // Parsear productos actuales
            const productosActuales = pedido.productos ? pedido.productos.split('|') : [];

            // Agregar nuevo producto
            const nuevoProducto = `${newItem.codigo}:${newItem.nombre}:${newItem.cantidad}:${newItem.precio}`;
            productosActuales.push(nuevoProducto);

            // Calcular nuevo total
            const nuevoTotal = pedido.total + (newItem.cantidad * newItem.precio);

            // Actualizar en Excel
            const updates = [
                { range: `Pedidos!H${pedido.rowIndex}`, values: [[productosActuales.join('|')]] },
                { range: `Pedidos!I${pedido.rowIndex}`, values: [[nuevoTotal]] }
            ];

            await this.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: business.spreadsheetId,
                resource: {
                    data: updates,
                    valueInputOption: 'USER_ENTERED'
                }
            });

            console.log(`✅ Producto agregado al pedido ${pedidoId}: ${newItem.nombre}`);
            return { success: true, pedidoId, nuevoTotal };

        } catch (error) {
            console.error('❌ Error agregando producto al pedido:', error.message);
            return { success: false, error: error.message };
        }
    }

    // ========================================
    // GOOGLE DRIVE - SUBIR IMÁGENES
    // ========================================

    async uploadImageToDrive(imageBuffer, filename, mimeType) {
        try {
            const fileMetadata = {
                name: filename,
                parents: [config.sheets.driveFolderId || 'root']
            };

            const media = {
                mimeType: mimeType,
                body: require('stream').Readable.from(imageBuffer)
            };

            const file = await this.drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id, webViewLink, webContentLink'
            });

            // Hacer el archivo público para que se pueda ver
            await this.drive.permissions.create({
                fileId: file.data.id,
                requestBody: {
                    role: 'reader',
                    type: 'anyone'
                }
            });

            console.log(`✅ Imagen subida a Drive: ${file.data.id}`);

            // Generar múltiples formatos de URL
            const fileId = file.data.id;

            return {
                success: true,
                fileId: fileId,
                webViewLink: file.data.webViewLink,
                // URL directa para mostrar en <img> (funciona mejor para imágenes)
                directLink: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
                // URL alternativa
                downloadLink: `https://drive.google.com/uc?export=download&id=${fileId}`
            };

        } catch (error) {
            console.error('❌ Error subiendo imagen a Drive:', error.message);
            return { success: false, error: error.message };
        }
    }

    // ========================================
    // CLIENTES POR NEGOCIO
    // ========================================

    async getAllClients(businessId) {
        const business = this.getBusiness(businessId);
        if (!business) return [];

        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: business.spreadsheetId,
                range: 'Clientes!A:I'
            });

            const rows = response.data.values || [];
            const clientes = [];

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row[0]) continue;

                clientes.push({
                    id: row[0],
                    whatsapp: row[1],
                    nombre: row[2],
                    telefono: row[3],
                    direccion: row[4],
                    fechaRegistro: row[5],
                    ultimaCompra: row[6],
                    departamento: row[7] || '',
                    ciudad: row[8] || '',
                    rowIndex: i + 1
                });
            }

            return clientes;

        } catch (error) {
            console.error('❌ Error obteniendo clientes:', error.message);
            return [];
        }
    }

    async findClient(businessId, whatsapp) {
        const business = this.getBusiness(businessId);
        if (!business) return null;

        try {
            const clientes = await this.getAllClients(businessId);
            const whatsappLimpio = whatsapp.replace(/[^0-9]/g, '');

            return clientes.find(c => {
                const whatsappCliente = (c.whatsapp || '').replace(/[^0-9]/g, '');
                return whatsappCliente.includes(whatsappLimpio) || whatsappLimpio.includes(whatsappCliente);
            });

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

                if (clientData.departamento) {
                    updates.push({
                        range: `Clientes!H${existingClient.rowIndex}`,
                        values: [[clientData.departamento]]
                    });
                }
                if (clientData.ciudad) {
                    updates.push({
                        range: `Clientes!I${existingClient.rowIndex}`,
                        values: [[clientData.ciudad]]
                    });
                }

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
                    fecha,
                    clientData.departamento || '',
                    clientData.ciudad || ''
                ]];

                await this.sheets.spreadsheets.values.append({
                    spreadsheetId: business.spreadsheetId,
                    range: 'Clientes!A:I',
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

    // ========================================
    // CONFIGURACIÓN DEL NEGOCIO
    // ========================================

    /**
     * Obtener configuración del negocio desde la pestaña "Configuracion"
     * @param {string} businessId 
     * @returns {Object} - Configuración del negocio
     */
    async getBusinessConfig(businessId) {
        const business = this.getBusiness(businessId);
        if (!business || !business.spreadsheetId) return null;

        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: business.spreadsheetId,
                range: 'Configuracion!A:B'
            });

            const rows = response.data.values || [];
            const config = {};

            for (const row of rows) {
                if (row[0] && row[1]) {
                    const campo = row[0].toLowerCase().trim().replace(/\s+/g, '_');
                    const valor = row[1].trim();
                    config[campo] = valor;
                }
            }

            return config;
        } catch (error) {
            console.log('⚠️ Pestaña Configuracion no encontrada para', businessId);
            return null;
        }
    }

    /**
     * Obtener métodos de pago activos de la configuración
     * @param {Object} config - Configuración del negocio
     * @returns {Array} - Lista de métodos de pago activos
     */
    getMetodosPago(config) {
        if (!config) return [];

        const metodos = [];

        // Helper para verificar SI/NO
        const isActivo = (valor) => valor?.toUpperCase() === 'SI';

        // Yape
        if (isActivo(config.yape_activo) && config.yape_numero) {
            metodos.push({
                tipo: 'yape',
                nombre: 'Yape',
                numero: config.yape_numero,
                titular: config.yape_titular || ''
            });
        }

        // Plin
        if (isActivo(config.plin_activo) && config.plin_numero) {
            metodos.push({
                tipo: 'plin',
                nombre: 'Plin',
                numero: config.plin_numero,
                titular: config.plin_titular || ''
            });
        }

        // BCP
        if (isActivo(config.bcp_activo) && config.bcp_cuenta) {
            metodos.push({
                tipo: 'banco',
                nombre: 'BCP',
                cuenta: config.bcp_cuenta,
                cci: config.bcp_cci || '',
                titular: config.bcp_titular || ''
            });
        }

        // Interbank
        if (isActivo(config.interbank_activo) && config.interbank_cuenta) {
            metodos.push({
                tipo: 'banco',
                nombre: 'Interbank',
                cuenta: config.interbank_cuenta,
                cci: config.interbank_cci || '',
                titular: config.interbank_titular || ''
            });
        }

        // BBVA
        if (isActivo(config.bbva_activo) && config.bbva_cuenta) {
            metodos.push({
                tipo: 'banco',
                nombre: 'BBVA',
                cuenta: config.bbva_cuenta,
                cci: config.bbva_cci || '',
                titular: config.bbva_titular || ''
            });
        }

        // Scotiabank
        if (isActivo(config.scotiabank_activo) && config.scotiabank_cuenta) {
            metodos.push({
                tipo: 'banco',
                nombre: 'Scotiabank',
                cuenta: config.scotiabank_cuenta,
                cci: config.scotiabank_cci || '',
                titular: config.scotiabank_titular || ''
            });
        }

        return metodos;
    }

    /**
     * Construir texto de métodos de pago para mensaje de WhatsApp (sin líneas divisoras)
     * @param {Object} config - Configuración del negocio
     * @returns {string} - Texto formateado con métodos de pago
     */
    construirTextoMetodosPago(config) {
        const metodos = this.getMetodosPago(config);

        if (metodos.length === 0) {
            return '';
        }

        let texto = 'MÉTODOS DE PAGO:\n\n';

        for (const metodo of metodos) {
            if (metodo.tipo === 'yape' || metodo.tipo === 'plin') {
                texto += `${metodo.nombre}: ${metodo.numero}\n`;
                if (metodo.titular) {
                    texto += `${metodo.titular}\n`;
                }
                texto += '\n';
            } else if (metodo.tipo === 'banco') {
                texto += `${metodo.nombre}: ${metodo.cuenta}\n`;
                if (metodo.cci) {
                    texto += `CCI: ${metodo.cci}\n`;
                }
                if (metodo.titular) {
                    texto += `${metodo.titular}\n`;
                }
                texto += '\n';
            }
        }

        return texto.trim();
    }

    // ========================================
    // EMPRESAS DE ENVÍO (MAESTRO)
    // ========================================

    /**
     * Obtener todas las empresas de envío desde el Excel maestro
     * @returns {Array} - Lista de sedes activas
     */
    async getEmpresasEnvio() {
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.masterSpreadsheetId,
                range: 'EmpresasEnvio!A:G'
            });

            const rows = response.data.values || [];
            if (rows.length < 2) return [];

            const empresas = [];

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row[6] === 'SI') { // Columna Activo
                    empresas.push({
                        empresa: row[0] || '',
                        sede: row[1] || '',
                        direccion: row[2] || '',
                        distrito: row[3] || '',
                        departamento: row[4] || '',
                        telefono: row[5] || ''
                    });
                }
            }

            return empresas;
        } catch (error) {
            console.log('⚠️ Pestaña EmpresasEnvio no encontrada en maestro');
            return [];
        }
    }

    /**
     * Obtener sedes de una empresa específica (solo en Lima para despacho)
     * @param {string} empresa - Nombre de la empresa
     * @returns {Array} - Lista de sedes en Lima
     */
    /**
     * Obtener sedes de una empresa en un departamento específico
     * @param {string} empresa - Nombre de la empresa (Shalom, Olva, etc)
     * @param {string} departamento - Departamento del cliente (Cusco, Arequipa, Lima, etc)
     */
    async getSedesEmpresa(empresa, departamento) {
        const todasEmpresas = await this.getEmpresasEnvio();

        // Normalizar para comparación
        const empresaLower = empresa.toLowerCase().trim();
        let deptoLower = '';
        if (departamento) {
            deptoLower = departamento.toLowerCase().trim()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Quitar tildes
        }

        // Filtrar por empresa Y departamento del cliente
        const sedes = todasEmpresas.filter(e => {
            const eEmpresa = e.empresa.toLowerCase().trim();
            const eDepto = e.departamento.toLowerCase().trim()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

            // Si no se especifica depto (ej. admin), mostrar todo de esa empresa
            if (!departamento) return eEmpresa === empresaLower;

            return eEmpresa === empresaLower && eDepto === deptoLower;
        });

        console.log(`Sedes de ${empresa} en ${departamento}:`, sedes.length);

        return sedes;
    }

    /**
     * Actualizar datos de envío en un pedido
     * @param {string} businessId 
     * @param {string} pedidoId 
     * @param {Object} shippingData - Datos de envío
     */
    async updateOrderShipping(businessId, pedidoId, shippingData) {
        const business = this.getBusiness(businessId);
        if (!business) return { success: false, error: 'Negocio no encontrado' };

        try {
            const pedido = await this.getOrderById(businessId, pedidoId);
            if (!pedido) {
                return { success: false, error: 'Pedido no encontrado' };
            }

            // Mapeo detallado de datos
            const departamento = shippingData.departamento_cliente || '';
            const ciudad = shippingData.ciudad_cliente || '';
            const tipo = shippingData.tipo_envio || '';

            // Método/Empresa (Col P)
            let metodoEmpresa = shippingData.metodo_envio || '';
            if (tipo === 'NACIONAL' && shippingData.empresa_envio) {
                metodoEmpresa = shippingData.empresa_envio;
            }

            // Detalle/Sede (Col Q)
            let detalleSede = '';
            if (tipo === 'NACIONAL') {
                detalleSede = shippingData.sede_envio ? `${shippingData.sede_envio} - ${shippingData.sede_direccion || ''}` : '';
            } else if (tipo === 'RECOJO') {
                detalleSede = 'Tienda'; // O la dirección de la tienda si estuviera disponible
            } else {
                // Para local, la dirección ya está en el pedido principal, pero podemos poner notas
                detalleSede = shippingData.detalle || '';
            }

            const costo = shippingData.costo_envio || 0;

            const valoresUpdate = [[
                departamento,
                ciudad,
                tipo,
                metodoEmpresa,
                detalleSede,
                costo
            ]];

            await this.sheets.spreadsheets.values.update({
                spreadsheetId: business.spreadsheetId,
                range: `Pedidos!M${pedido.rowIndex}:R${pedido.rowIndex}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: valoresUpdate }
            });

            console.log(`✅ Envío actualizado para pedido ${pedidoId}: ${shippingData.tipo_envio}`);
            return { success: true };

        } catch (error) {
            console.error('❌ Error actualizando envío:', error.message);
            return { success: false, error: error.message };
        }
    }
    // ==========================================
    // PREFERENCIAS DE ENVÍO Y PAGO
    // ==========================================

    helperColumnToLetter(column) {
        let temp, letter = '';
        while (column > 0) {
            temp = (column - 1) % 26;
            letter = String.fromCharCode(temp + 65) + letter;
            column = (column - temp - 1) / 26;
        }
        return letter;
    }

    /**
     * Actualizar preferencias de envío del cliente
     */
    async updateClientShippingPreferences(businessId, whatsapp, shippingData) {
        const business = this.getBusiness(businessId);
        if (!business) return false;

        try {
            // Buscar cliente para obtener su fila
            const existingClient = await this.findClient(businessId, whatsapp);

            if (!existingClient) {
                console.log('Cliente no encontrado para actualizar preferencias');
                return false;
            }

            const updates = [];
            const rowIndex = existingClient.rowIndex;

            // Map keys to columns (Assuming A=1, so J=10, K=11, etc.)
            // H=Department, I=City
            // J=Tipo Envío, K=Empresa, L=Sede, M=Dirección Sede

            if (shippingData.departamento) {
                updates.push({
                    range: `Clientes!H${rowIndex}`,
                    values: [[shippingData.departamento]]
                });
            }
            if (shippingData.ciudad) {
                updates.push({
                    range: `Clientes!I${rowIndex}`,
                    values: [[shippingData.ciudad]]
                });
            }
            if (shippingData.tipoEnvio) {
                updates.push({
                    range: `Clientes!J${rowIndex}`,
                    values: [[shippingData.tipoEnvio]]
                });
            }
            if (shippingData.empresa !== undefined) {
                updates.push({
                    range: `Clientes!K${rowIndex}`,
                    values: [[shippingData.empresa || '']]
                });
            }
            if (shippingData.sede !== undefined) {
                updates.push({
                    range: `Clientes!L${rowIndex}`,
                    values: [[shippingData.sede || '']]
                });
            }
            if (shippingData.sedeDireccion !== undefined) {
                updates.push({
                    range: `Clientes!M${rowIndex}`,
                    values: [[shippingData.sedeDireccion || '']]
                });
            }

            if (updates.length > 0) {
                await this.sheets.spreadsheets.values.batchUpdate({
                    spreadsheetId: business.spreadsheetId,
                    resource: {
                        data: updates,
                        valueInputOption: 'USER_ENTERED'
                    }
                });
            }

            console.log(`✅ Preferencias de envío actualizadas para ${whatsapp}`);
            return true;

        } catch (error) {
            console.error('❌ Error actualizando preferencias de envío:', error.message);
            return false;
        }
    }

    /**
     * Obtener preferencias de envío del cliente
     */
    async getClientShippingPreferences(businessId, whatsapp) {
        const business = this.getBusiness(businessId);
        if (!business) return null;

        try {
            // Leer rango extendido para incluir preferencias
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: business.spreadsheetId,
                range: 'Clientes!A:M'
            });

            const rows = response.data.values || [];
            // Buscar cliente
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row[1] === whatsapp) { // Col B is Whatsapp
                    // Si tiene tipo de envío preferido (Col J index 9)
                    if (row[9]) {
                        return {
                            ciudad: row[8] || '', // I
                            departamento: row[7] || '', // H
                            tipoEnvio: row[9], // J
                            empresa: row[10] || '', // K
                            sede: row[11] || '', // L
                            sedeDireccion: row[12] || '' // M
                        };
                    }
                }
            }
            return null;
        } catch (error) {
            console.error('Error obteniendo preferencias:', error.message);
            return null;
        }
    }

    /**
     * Obtener el último pedido del cliente
     */
    async getLastOrder(businessId, whatsapp) {
        const business = this.getBusiness(businessId);
        if (!business) return null;

        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: business.spreadsheetId,
                range: 'Pedidos!A:S'
            });

            const rows = response.data.values || [];
            if (rows.length < 2) return null;

            // Headers row 0. Find Whatsapp col (Col B usually? let's assume standard layout or find by name)
            // Layout assumption from other methods: A=ID, B=WA

            // Iterate backwards to find last order
            for (let i = rows.length - 1; i >= 1; i--) {
                const row = rows[i];
                if (row[1] === whatsapp) { // Col B is WhatsApp
                    return await this.parseOrder(row, i + 1);
                }
            }
            return null;
        } catch (error) {
            console.error('Error obteniendo último pedido:', error.message);
            return null;
        }
    }

    /**
     * Parsear métodos de pago
     */
    getMetodosPago(config) {
        const metodos = [];
        if (!config || !config.cuentasBancarias) return metodos;

        const cuentas = config.cuentasBancarias.split('|');
        cuentas.forEach(cuenta => {
            // Formato esperado: "Banco:Numero" o "Yape:Numero"
            // Pero mejor si es más flexible. Asumimos texto simple por ahora
            const parts = cuenta.split(':');
            if (parts.length >= 2) {
                const tipo = parts[0].trim().toLowerCase();
                const isWallet = tipo.includes('yape') || tipo.includes('plin');

                metodos.push({
                    tipo: isWallet ? 'yape' : 'banco',
                    nombre: parts[0].trim(),
                    numero: parts[1].trim(), // Para wallets
                    cuenta: parts[1].trim(), // Para bancos
                    titular: '', // No tenemos titular separado en el formato actual simple
                    cci: ''
                });
            }
        });
        return metodos;
    }
}

module.exports = new SheetsService();
