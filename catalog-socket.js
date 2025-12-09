/**
 * Catalog Socket - WebSocket para el catálogo web
 * Permite mostrar productos en tiempo real cuando el admin los publica
 */

let io = null;

// Almacenar conexiones por negocio
const businessRooms = {};

/**
 * Inicializar Socket.IO
 */
function initialize(httpServer) {
    const { Server } = require('socket.io');

    io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log('📱 Cliente web conectado:', socket.id);

        // Cliente se une a un negocio específico
        socket.on('join-catalog', (businessId) => {
            socket.join(`catalog-${businessId}`);

            if (!businessRooms[businessId]) {
                businessRooms[businessId] = new Set();
            }
            businessRooms[businessId].add(socket.id);

            console.log(`👁️ Cliente ${socket.id} viendo catálogo de ${businessId}`);
            console.log(`   Viewers en ${businessId}: ${businessRooms[businessId].size}`);

            // Notificar cantidad de viewers al admin
            io.to(`admin-${businessId}`).emit('viewers-update', {
                businessId,
                count: businessRooms[businessId].size
            });
        });

        // Admin se une a su panel
        socket.on('join-admin', (businessId) => {
            socket.join(`admin-${businessId}`);
            console.log(`🔧 Admin conectado para ${businessId}`);

            // Enviar cantidad actual de viewers
            const viewerCount = businessRooms[businessId]?.size || 0;
            socket.emit('viewers-update', {
                businessId,
                count: viewerCount
            });
        });

        // Cliente sale del catálogo
        socket.on('leave-catalog', (businessId) => {
            socket.leave(`catalog-${businessId}`);

            if (businessRooms[businessId]) {
                businessRooms[businessId].delete(socket.id);

                // Notificar al admin
                io.to(`admin-${businessId}`).emit('viewers-update', {
                    businessId,
                    count: businessRooms[businessId].size
                });
            }
        });

        // Desconexión
        socket.on('disconnect', () => {
            console.log('📴 Cliente desconectado:', socket.id);

            // Limpiar de todos los rooms
            Object.keys(businessRooms).forEach(businessId => {
                if (businessRooms[businessId].has(socket.id)) {
                    businessRooms[businessId].delete(socket.id);

                    // Notificar al admin
                    io.to(`admin-${businessId}`).emit('viewers-update', {
                        businessId,
                        count: businessRooms[businessId].size
                    });
                }
            });
        });
    });

    console.log('🔌 Socket.IO inicializado para catálogo web');
    return io;
}

/**
 * Publicar producto a todos los viewers del catálogo
 * Esto muestra el modal en tiempo real
 */
function broadcastProduct(businessId, producto) {
    if (!io) {
        console.log('⚠️ Socket.IO no inicializado');
        return { success: false, viewers: 0 };
    }

    const viewerCount = businessRooms[businessId]?.size || 0;

    console.log(`📢 Publicando producto ${producto.codigo} a ${viewerCount} viewers`);

    // Emitir a todos los clientes viendo el catálogo de este negocio
    // (Socket.IO no falla si no hay listeners)
    io.to(`catalog-${businessId}`).emit('product-live', {
        businessId,
        producto: {
            id: producto.codigo,
            codigo: producto.codigo,
            nombre: producto.nombre,
            descripcion: producto.descripcion || '',
            precio: producto.precio,
            imagen: producto.imagenUrl || producto.imagen || '',
            disponible: producto.disponible,
            stock: producto.stock,
            estado: producto.estado || 'PUBLICADO'
        },
        timestamp: Date.now()
    });

    // Siempre retornar success: true
    return { success: true, viewers: viewerCount };
}

/**
 * Notificar que un producto fue apartado
 */
function notifyProductReserved(businessId, productCode, remainingStock) {
    if (!io) return;

    io.to(`catalog-${businessId}`).emit('product-reserved', {
        businessId,
        productCode,
        remainingStock,
        timestamp: Date.now()
    });
}

/**
 * Obtener cantidad de viewers
 */
function getViewerCount(businessId) {
    return businessRooms[businessId]?.size || 0;
}

/**
 * Obtener instancia de io
 */
function getIO() {
    return io;
}

module.exports = {
    initialize,
    broadcastProduct,
    notifyProductReserved,
    getViewerCount,
    getIO
};
