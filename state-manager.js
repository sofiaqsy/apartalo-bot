/**
 * State Manager - Multi-tenant Session Management
 * Maneja estados de usuario, carritos y reservas por negocio
 */

class StateManager {
    constructor() {
        // Estado de conversacion por usuario
        // Key: phoneNumber, Value: { step, businessId, data }
        this.userSessions = new Map();
        
        // Carritos por usuario
        // Key: `${phoneNumber}_${businessId}`, Value: [{ codigo, producto, cantidad, precio, reservadoEn }]
        this.carts = new Map();
        
        // Suscripciones: usuarios suscritos a negocios
        // Key: phoneNumber, Value: Set de businessIds
        this.subscriptions = new Map();
        
        // Cache de clientes por negocio
        // Key: `${phoneNumber}_${businessId}`, Value: clientData
        this.clientCache = new Map();
        
        console.log('📦 StateManager Multi-tenant inicializado');
    }
    
    // ========================================
    // SESIONES DE USUARIO
    // ========================================
    
    getSession(phoneNumber) {
        return this.userSessions.get(phoneNumber) || {
            step: 'inicio',
            businessId: null,
            data: {}
        };
    }
    
    setSession(phoneNumber, session) {
        this.userSessions.set(phoneNumber, {
            ...session,
            lastActivity: new Date()
        });
    }
    
    setStep(phoneNumber, step, data = {}) {
        const session = this.getSession(phoneNumber);
        this.setSession(phoneNumber, {
            ...session,
            step,
            data: { ...session.data, ...data }
        });
    }
    
    setActiveBusiness(phoneNumber, businessId) {
        const session = this.getSession(phoneNumber);
        this.setSession(phoneNumber, {
            ...session,
            businessId
        });
    }
    
    getActiveBusiness(phoneNumber) {
        const session = this.getSession(phoneNumber);
        return session.businessId;
    }
    
    resetSession(phoneNumber) {
        const session = this.getSession(phoneNumber);
        this.userSessions.set(phoneNumber, {
            step: 'inicio',
            businessId: session.businessId,
            data: {}
        });
    }
    
    // ========================================
    // CARRITOS
    // ========================================
    
    getCart(phoneNumber, businessId) {
        const key = `${phoneNumber}_${businessId}`;
        return this.carts.get(key) || [];
    }
    
    addToCart(phoneNumber, businessId, item) {
        const key = `${phoneNumber}_${businessId}`;
        const cart = this.getCart(phoneNumber, businessId);
        
        const existingIndex = cart.findIndex(i => i.codigo === item.codigo);
        
        if (existingIndex >= 0) {
            cart[existingIndex].cantidad += item.cantidad;
            cart[existingIndex].subtotal = cart[existingIndex].cantidad * cart[existingIndex].precio;
        } else {
            cart.push({
                ...item,
                subtotal: item.cantidad * item.precio,
                reservadoEn: new Date()
            });
        }
        
        this.carts.set(key, cart);
        return cart;
    }
    
    removeFromCart(phoneNumber, businessId, codigo) {
        const key = `${phoneNumber}_${businessId}`;
        const cart = this.getCart(phoneNumber, businessId);
        const newCart = cart.filter(item => item.codigo !== codigo);
        this.carts.set(key, newCart);
        return newCart;
    }
    
    clearCart(phoneNumber, businessId) {
        const key = `${phoneNumber}_${businessId}`;
        this.carts.delete(key);
    }
    
    getCartTotal(phoneNumber, businessId) {
        const cart = this.getCart(phoneNumber, businessId);
        return cart.reduce((total, item) => total + item.subtotal, 0);
    }
    
    // ========================================
    // SUSCRIPCIONES
    // ========================================
    
    subscribe(phoneNumber, businessId) {
        if (!this.subscriptions.has(phoneNumber)) {
            this.subscriptions.set(phoneNumber, new Set());
        }
        this.subscriptions.get(phoneNumber).add(businessId);
    }
    
    isSubscribed(phoneNumber, businessId) {
        const subs = this.subscriptions.get(phoneNumber);
        return subs ? subs.has(businessId) : false;
    }
    
    getSubscriptions(phoneNumber) {
        const subs = this.subscriptions.get(phoneNumber);
        return subs ? Array.from(subs) : [];
    }
    
    // ========================================
    // CACHE DE CLIENTES
    // ========================================
    
    cacheClient(phoneNumber, businessId, clientData) {
        const key = `${phoneNumber}_${businessId}`;
        this.clientCache.set(key, {
            ...clientData,
            cachedAt: new Date()
        });
    }
    
    getCachedClient(phoneNumber, businessId) {
        const key = `${phoneNumber}_${businessId}`;
        return this.clientCache.get(key);
    }
    
    // ========================================
    // UTILIDADES
    // ========================================
    
    getStats() {
        return {
            activeSessions: this.userSessions.size,
            activeCarts: this.carts.size,
            totalSubscriptions: Array.from(this.subscriptions.values())
                .reduce((sum, set) => sum + set.size, 0)
        };
    }
    
    cleanupInactiveSessions() {
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        let cleaned = 0;
        
        this.userSessions.forEach((session, phone) => {
            if (session.lastActivity && session.lastActivity < thirtyMinutesAgo) {
                this.userSessions.set(phone, {
                    ...session,
                    step: 'inicio',
                    data: {}
                });
                cleaned++;
            }
        });
        
        if (cleaned > 0) {
            console.log(`🧹 Limpiadas ${cleaned} sesiones inactivas`);
        }
    }
}

module.exports = new StateManager();
