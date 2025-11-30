/**
 * Live Commerce Manager
 * Maneja suscripciones temporales y broadcast de productos en vivo
 */

class LiveManager {
    constructor() {
        // Map: businessId -> Map(userWhatsapp -> {subscribedAt, expiresAt, nombre})
        this.subscribers = new Map();
        
        // Map: `${businessId}-${productCode}` -> {reservedBy, reservedAt, producto}
        this.liveProducts = new Map();
        
        // Limpiar suscripciones expiradas cada 30 segundos
        setInterval(() => this.cleanExpiredSubscriptions(), 30000);
        
        console.log('🔴 Live Manager inicializado');
    }
    
    // ========================================
    // SUSCRIPCIONES
    // ========================================
    
    /**
     * Suscribir usuario al live de un negocio
     */
    subscribe(businessId, userWhatsapp, userName, durationMinutes = 5) {
        if (!this.subscribers.has(businessId)) {
            this.subscribers.set(businessId, new Map());
        }
        
        const businessSubs = this.subscribers.get(businessId);
        const now = Date.now();
        const expiresAt = now + (durationMinutes * 60 * 1000);
        
        businessSubs.set(userWhatsapp, {
            nombre: userName || 'Usuario',
            subscribedAt: now,
            expiresAt: expiresAt,
            durationMinutes: durationMinutes
        });
        
        console.log(`🔴 ${userName || userWhatsapp} suscrito al LIVE de ${businessId} por ${durationMinutes} min`);
        
        return {
            success: true,
            expiresAt: expiresAt,
            expiresIn: durationMinutes * 60 * 1000
        };
    }
    
    /**
     * Cancelar suscripción
     */
    unsubscribe(businessId, userWhatsapp) {
        if (!this.subscribers.has(businessId)) return false;
        
        const businessSubs = this.subscribers.get(businessId);
        const deleted = businessSubs.delete(userWhatsapp);
        
        if (deleted) {
            console.log(`⚪ ${userWhatsapp} salió del LIVE de ${businessId}`);
        }
        
        return deleted;
    }
    
    /**
     * Verificar si usuario está suscrito
     */
    isSubscribed(businessId, userWhatsapp) {
        if (!this.subscribers.has(businessId)) return false;
        
        const businessSubs = this.subscribers.get(businessId);
        const sub = businessSubs.get(userWhatsapp);
        
        if (!sub) return false;
        
        // Verificar si expiró
        if (Date.now() > sub.expiresAt) {
            businessSubs.delete(userWhatsapp);
            return false;
        }
        
        return true;
    }
    
    /**
     * Obtener lista de suscritos activos de un negocio
     */
    getSubscribers(businessId) {
        if (!this.subscribers.has(businessId)) return [];
        
        const businessSubs = this.subscribers.get(businessId);
        const now = Date.now();
        const activeSubs = [];
        
        for (const [whatsapp, sub] of businessSubs.entries()) {
            if (now <= sub.expiresAt) {
                activeSubs.push({
                    whatsapp: whatsapp,
                    nombre: sub.nombre,
                    subscribedAt: sub.subscribedAt,
                    expiresAt: sub.expiresAt,
                    remainingMs: sub.expiresAt - now
                });
            } else {
                // Limpiar expirado
                businessSubs.delete(whatsapp);
            }
        }
        
        return activeSubs;
    }
    
    /**
     * Contar suscritos activos
     */
    getSubscriberCount(businessId) {
        return this.getSubscribers(businessId).length;
    }
    
    /**
     * Limpiar suscripciones expiradas
     */
    cleanExpiredSubscriptions() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [businessId, businessSubs] of this.subscribers.entries()) {
            for (const [whatsapp, sub] of businessSubs.entries()) {
                if (now > sub.expiresAt) {
                    businessSubs.delete(whatsapp);
                    cleaned++;
                }
            }
        }
        
        if (cleaned > 0) {
            console.log(`🧹 Limpiadas ${cleaned} suscripciones expiradas`);
        }
    }
    
    // ========================================
    // PRODUCTOS EN VIVO
    // ========================================
    
    /**
     * Publicar producto en vivo (disponible para reserva instantánea)
     */
    publishProduct(businessId, producto) {
        const key = `${businessId}-${producto.codigo}`;
        
        this.liveProducts.set(key, {
            businessId: businessId,
            producto: producto,
            publishedAt: Date.now(),
            reservedBy: null,
            reservedAt: null,
            status: 'DISPONIBLE'
        });
        
        console.log(`📢 Producto publicado en LIVE: ${producto.codigo} - ${producto.nombre}`);
        
        return {
            success: true,
            key: key,
            subscriberCount: this.getSubscriberCount(businessId)
        };
    }
    
    /**
     * Intentar reservar producto en vivo
     * IMPORTANTE: Solo el primero que llame gana
     */
    tryReserve(businessId, productCode, userWhatsapp, userName) {
        const key = `${businessId}-${productCode}`;
        const liveProduct = this.liveProducts.get(key);
        
        if (!liveProduct) {
            return {
                success: false,
                reason: 'PRODUCTO_NO_ENCONTRADO',
                message: 'Este producto ya no está disponible en el live'
            };
        }
        
        // ¡Ya fue reservado!
        if (liveProduct.reservedBy) {
            return {
                success: false,
                reason: 'YA_RESERVADO',
                message: '¡Ups! Alguien más fue más rápido 😅',
                reservedBy: liveProduct.reservedBy
            };
        }
        
        // ¡RESERVADO! Primero en llegar
        liveProduct.reservedBy = userWhatsapp;
        liveProduct.reservedByName = userName;
        liveProduct.reservedAt = Date.now();
        liveProduct.status = 'RESERVADO';
        
        console.log(`🎉 ¡RESERVADO! ${productCode} para ${userName || userWhatsapp}`);
        
        return {
            success: true,
            reason: 'RESERVADO',
            message: `🎉 ¡Lo apartaste! ${liveProduct.producto.nombre}`,
            producto: liveProduct.producto
        };
    }
    
    /**
     * Obtener estado de producto en vivo
     */
    getLiveProduct(businessId, productCode) {
        const key = `${businessId}-${productCode}`;
        return this.liveProducts.get(key);
    }
    
    /**
     * Obtener todos los productos en vivo de un negocio
     */
    getLiveProducts(businessId) {
        const products = [];
        
        for (const [key, data] of this.liveProducts.entries()) {
            if (data.businessId === businessId) {
                products.push({
                    codigo: data.producto.codigo,
                    nombre: data.producto.nombre,
                    precio: data.producto.precio,
                    status: data.status,
                    reservedBy: data.reservedBy,
                    publishedAt: data.publishedAt
                });
            }
        }
        
        return products;
    }
    
    /**
     * Limpiar producto del live (después de confirmar pedido)
     */
    clearLiveProduct(businessId, productCode) {
        const key = `${businessId}-${productCode}`;
        return this.liveProducts.delete(key);
    }
    
    // ========================================
    // ESTADÍSTICAS
    // ========================================
    
    getStats(businessId) {
        return {
            subscriberCount: this.getSubscriberCount(businessId),
            subscribers: this.getSubscribers(businessId),
            liveProducts: this.getLiveProducts(businessId),
            liveProductCount: this.getLiveProducts(businessId).length
        };
    }
}

module.exports = new LiveManager();
