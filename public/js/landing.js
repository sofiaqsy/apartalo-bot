// Estado global
let currentBusiness = null;
let currentProduct = null;
let businesses = {};
let products = [];
let imageRotationIntervals = {}; // Para manejar los intervalos de rotación

// Socket.IO
let socket = null;
let currentLiveProduct = null;

// Countdown timer para modal LIVE
let liveCountdownInterval = null;
let liveSecondsRemaining = 60;

// Inicializar app
async function init() {
    // Inicializar Socket.IO
    initSocket();

    const urlParams = new URLSearchParams(window.location.search);
    const businessId = urlParams.get('business');

    if (businessId) {
        await openBusinessDirect(businessId);
    } else {
        await loadBusinesses();
    }
}

// Cargar negocios desde API
async function loadBusinesses() {
    try {
        const response = await fetch('/api/businesses');
        const data = await response.json();

        if (data.success) {
            businesses = data.businesses;
            renderBusinesses(data.businesses);
        } else {
            showError('Error cargando negocios');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Error de conexión');
    }
}

// Renderizar tarjetas de negocios
function renderBusinesses(businessList) {
    const grid = document.getElementById('businessGrid');
    const loading = document.getElementById('homeLoading');

    loading.style.display = 'none';

    if (businessList.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">○</div>
                <p class="empty-text">No hay negocios disponibles</p>
                <p class="empty-subtext">Pronto tendremos más opciones</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = businessList.map(business => `
        <div class="business-card" onclick="openBusiness('${business.id}')">
            <img src="${business.imagen || '/icon-192.svg'}" class="business-image" onerror="this.src='/icon-192.svg'">
            <div class="business-info">
                <h3 class="business-name">${business.nombre}</h3>
                <p class="business-desc">${business.descripcion || 'Catálogo de productos'}</p>
                <div class="business-stats">
                    <span class="product-count">Ver catálogo →</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Abrir negocio desde home
async function openBusiness(businessId) {
    currentBusiness = businessId;
    joinBusinessRoom(businessId); // Unirse al room de Socket.IO

    const url = new URL(window.location);
    url.searchParams.set('business', businessId);
    window.history.pushState({}, '', url);

    await loadProducts(businessId);
}

// Abrir negocio directo desde URL
async function openBusinessDirect(businessId) {
    currentBusiness = businessId;
    joinBusinessRoom(businessId); // Unirse al room de Socket.IO

    document.getElementById('homeView').classList.remove('active');
    document.getElementById('productsView').classList.add('active');

    await loadProducts(businessId);
}

// Cargar productos desde API
async function loadProducts(businessId) {
    try {
        const response = await fetch(`/api/products/${businessId}`);
        const data = await response.json();

        if (data.success) {
            products = data.products;
            renderCatalogInfo(data.business);
            renderProducts(data.products);

            document.getElementById('homeView').classList.remove('active');
            document.getElementById('productsView').classList.add('active');
            window.scrollTo(0, 0);
        } else {
            showError('Error cargando productos');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Error de conexión');
    }
}

// Renderizar info del catálogo
function renderCatalogInfo(business) {
    const container = document.getElementById('catalogInfo');

    container.innerHTML = `
        <div class="catalog-header">
            <img src="${business.imagen || '/icon-192.svg'}" class="catalog-logo" onerror="this.src='/icon-192.svg'">
            <div>
                <h1 class="catalog-title">${business.nombre}</h1>
                <p class="catalog-subtitle">${business.descripcion || 'Catálogo de productos'}</p>
            </div>
        </div>
        <div class="catalog-contact">
            ${business.whatsapp ? `<a href="https://wa.me/${business.whatsapp}" target="_blank" class="contact-btn">WhatsApp</a>` : ''}
            ${business.tiktok ? `<a href="${business.tiktok}" target="_blank" class="contact-btn">TikTok</a>` : ''}
        </div>
    `;
}

// Limpiar todos los intervalos de rotación
function clearAllImageRotations() {
    Object.values(imageRotationIntervals).forEach(interval => clearInterval(interval));
    imageRotationIntervals = {};
}

// Iniciar rotación de imágenes para una card
function startImageRotation(cardId, images) {
    if (images.length <= 1) return;

    let currentIndex = 0;
    const imgElement = document.getElementById(`product-img-${cardId}`);
    const dotsContainer = document.getElementById(`dots-${cardId}`);

    if (!imgElement) return;

    // Crear indicadores de puntos
    if (dotsContainer) {
        dotsContainer.innerHTML = images.map((_, i) =>
            `<span class="dot ${i === 0 ? 'active' : ''}"></span>`
        ).join('');
    }

    imageRotationIntervals[cardId] = setInterval(() => {
        currentIndex = (currentIndex + 1) % images.length;

        // Efecto de fade lento y suave
        imgElement.style.opacity = '0';

        setTimeout(() => {
            imgElement.src = images[currentIndex];
            imgElement.style.opacity = '1';

            // Actualizar dots
            if (dotsContainer) {
                dotsContainer.querySelectorAll('.dot').forEach((dot, i) => {
                    dot.classList.toggle('active', i === currentIndex);
                });
            }
        }, 800);
    }, 4500); // Cambiar cada 4.5 segundos
}

// Renderizar productos en grid
function renderProducts(productList) {
    const grid = document.getElementById('productsGrid');

    // Limpiar intervalos anteriores
    clearAllImageRotations();

    if (productList.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-icon">○</div>
                <p class="empty-text">No hay productos disponibles</p>
                <p class="empty-subtext">Vuelve pronto para ver nuevos productos</p>
                <button onclick="goBack()" style="margin-top: 1.5rem; padding: 0.75rem 2rem; background: var(--primary); border: none; border-radius: 10px; color: #000; font-weight: 600; cursor: pointer;">Volver</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = productList.map((product, index) => {
        const images = product.imagen ? product.imagen.split('|').filter(i => i) : [];
        const imageCount = images.length;
        const mainImage = images[0] || '/icon-192.svg';

        // Determinar estado del producto
        const isComingSoon = product.estado === 'ACTIVO'; // Próximamente
        const isOutOfStock = !isComingSoon && product.disponible <= 0;
        const isAvailable = !isComingSoon && product.disponible > 0;

        // Clases CSS
        const cardClasses = [
            'product-card',
            isComingSoon ? 'coming-soon' : '',
            isOutOfStock ? 'out-of-stock' : ''
        ].filter(Boolean).join(' ');

        // Solo permitir click si está disponible
        const clickHandler = isAvailable ? `onclick="openProductModal(${index})"` : '';

        return `
            <div class="${cardClasses}" ${clickHandler}>
                ${isComingSoon ? '<div class="coming-soon-badge">Próximamente</div>' : ''}
                ${isOutOfStock ? '<div class="out-of-stock-badge">Agotado</div>' : ''}
                
                <div class="product-image-container">
                    <img 
                        src="${mainImage}" 
                        class="product-image" 
                        id="product-img-${index}"
                        onerror="this.src='/icon-192.svg'"
                    >
                    ${!isComingSoon && !isOutOfStock ? `
                        <span class="product-badge badge-available">Disponible</span>
                    ` : ''}
                    ${imageCount > 1 && !isComingSoon ? `
                        <div class="image-dots" id="dots-${index}"></div>
                    ` : ''}
                </div>
                <div class="product-details">
                    <h3 class="product-name">${product.nombre}</h3>
                    <div class="product-price">S/${parseFloat(product.precio).toFixed(2)}</div>
                    ${product.descripcion ? `<p class="product-desc">${product.descripcion}</p>` : ''}
                    ${!isComingSoon ? `
                        <div class="product-stock ${product.disponible <= 3 && product.disponible > 0 ? 'low' : ''}" style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.5rem;">
                            ${product.disponible} disponible${product.disponible !== 1 ? 's' : ''}
                        </div>
                    ` : ''}
                    <button 
                        class="apartalo-btn ${isComingSoon || isOutOfStock ? 'disabled' : ''}" 
                        onclick="event.stopPropagation(); ${isAvailable ? `apartarProducto(${index})` : ''}"
                        ${isComingSoon || isOutOfStock ? 'disabled' : ''}
                    >
                        ${isComingSoon ? 'PRÓXIMAMENTE' : (isOutOfStock ? 'AGOTADO' : 'APARTAR')}
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Iniciar rotación para productos con múltiples imágenes (solo para disponibles)
    productList.forEach((product, index) => {
        if (product.estado === 'ACTIVO') return; // No rotar en próximamente
        const images = product.imagen ? product.imagen.split('|').filter(i => i) : [];
        if (images.length > 1) {
            // Pequeño delay para asegurar que el DOM está listo
            setTimeout(() => startImageRotation(index, images), 100 + (index * 50));
        }
    });
}

// Abrir modal de producto
function openProductModal(index) {
    const product = products[index];
    if (!product) return;

    // No abrir modal para productos próximamente
    if (product.estado === 'ACTIVO') return;

    currentProduct = { ...product, index };

    const modal = document.getElementById('productModal');
    const gallery = document.getElementById('modalGallery');
    const info = document.getElementById('modalInfo');

    const images = product.imagen ? product.imagen.split('|').filter(i => i) : [];
    const mainImage = images[0] || '/icon-192.svg';
    const isComingSoon = product.estado === 'ACTIVO';
    const isOutOfStock = product.disponible <= 0;
    const isAvailable = !isComingSoon && product.disponible > 0;

    // Renderizar galería
    gallery.innerHTML = `
        <img src="${mainImage}" class="gallery-main-image" id="galleryMainImage" onerror="this.src='/icon-192.svg'">
        ${images.length > 1 ? `
            <div class="gallery-thumbnails">
                ${images.map((img, i) => `
                    <img src="${img}" class="gallery-thumb ${i === 0 ? 'active' : ''}" onclick="changeGalleryImage('${img}', this)" onerror="this.style.display='none'">
                `).join('')}
            </div>
        ` : ''}
    `;

    // Renderizar info
    info.innerHTML = `
        <h2 class="modal-product-name">${product.nombre}</h2>
        <div class="modal-product-price">S/${parseFloat(product.precio).toFixed(2)}</div>
        ${product.descripcion ? `<p class="modal-product-desc">${product.descripcion}</p>` : ''}
        <div class="modal-stock ${product.disponible <= 3 && product.disponible > 0 ? 'low' : ''}">
            ${isAvailable ? `${product.disponible} disponible${product.disponible > 1 ? 's' : ''}` : (isOutOfStock ? 'Sin stock' : 'Próximamente')}
        </div>
        <button 
            class="modal-apartalo-btn ${!isAvailable ? 'disabled' : ''}" 
            onclick="apartarProducto(${index})"
            ${!isAvailable ? 'disabled' : ''}
        >
            ${isAvailable ? 'APARTAR AHORA' : (isOutOfStock ? 'AGOTADO' : 'PRÓXIMAMENTE')}
        </button>
    `;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Cambiar imagen en galería
function changeGalleryImage(src, thumb) {
    document.getElementById('galleryMainImage').src = src;
    document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
}

// Cerrar modal de producto
function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
    document.body.style.overflow = '';
    currentProduct = null;
}

// WhatsApp de ApartaLo
const APARTALO_WHATSAPP = '19895335574';

// Apartar producto - Redirige directo a WhatsApp
function apartarProducto(index) {
    const product = products[index];

    // Cerrar modal si está abierto
    closeProductModal();

    // Construir mensaje para WhatsApp
    const mensaje = `APARTADO_WEB
Negocio: ${currentBusiness}
NegocioID: ${currentBusiness}
Producto: ${product.id}
Nombre: ${product.nombre}
Precio: S/${parseFloat(product.precio).toFixed(2)}

Quiero apartar este producto`;

    // Generar URL de WhatsApp
    const whatsappUrl = `https://wa.me/${APARTALO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;

    // Redirigir inmediatamente
    window.location.href = whatsappUrl;
}

// Volver al home
function goBack() {
    clearAllImageRotations(); // Limpiar intervalos al salir

    const url = new URL(window.location);
    url.searchParams.delete('business');
    window.history.pushState({}, '', url);

    document.getElementById('productsView').classList.remove('active');
    document.getElementById('homeView').classList.add('active');
    closeProductModal();
    window.scrollTo(0, 0);
}

// Compartir link
function shareLink() {
    const url = window.location.href;

    if (navigator.share) {
        navigator.share({
            title: 'ApartaLo',
            text: 'Mira estos productos',
            url: url
        }).catch(err => console.log('Error sharing:', err));
    } else {
        navigator.clipboard.writeText(url).then(() => {
            alert('Link copiado');
        }).catch(err => {
            console.error('Error copying:', err);
        });
    }
}

// Mostrar error
function showError(message) {
    alert(message);
}

// ========================================
// SOCKET.IO - Conexión en tiempo real
// ========================================

function initSocket() {
    if (typeof io === 'undefined') {
        console.log('Socket.IO no disponible');
        return;
    }

    socket = io();

    socket.on('connect', () => {
        console.log('🔌 Conectado al servidor');
        // Si ya estamos viendo un negocio, unirnos a su room
        if (currentBusiness) {
            socket.emit('join-catalog', currentBusiness);
            console.log('👁️ Viendo catálogo:', currentBusiness);
        }
    });

    socket.on('disconnect', () => {
        console.log('📴 Desconectado del servidor');
    });

    // Producto en vivo - mostrar modal
    socket.on('product-live', (data) => {
        console.log('📢 Producto en VIVO:', data);
        showLiveModal(data.producto);

        // Vibrar dispositivo si está soportado
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }
    });

    // Stock actualizado
    socket.on('product-reserved', (data) => {
        console.log('📦 Stock actualizado:', data);
        updateProductStock(data.productCode, data.remainingStock);
    });
}

// Unirse al room del negocio cuando se abre
function joinBusinessRoom(businessId) {
    if (socket && socket.connected) {
        socket.emit('join-catalog', businessId);
        console.log('👁️ Viendo catálogo:', businessId);
    }
}

// ========================================
// LIVE MODAL - Producto en tiempo real con contador
// ========================================

function showLiveModal(producto) {
    currentLiveProduct = producto;

    const modal = document.getElementById('liveModal');
    if (!modal) return;

    // Llenar datos del producto
    const images = producto.imagen ? producto.imagen.split('|') : [];
    const mainImg = images[0] || '/icon-192.svg';

    document.getElementById('liveProductImage').src = mainImg;
    document.getElementById('liveProductName').textContent = producto.nombre;
    document.getElementById('liveProductPrice').textContent = `S/${parseFloat(producto.precio).toFixed(2)}`;
    document.getElementById('liveProductDesc').textContent = producto.descripcion || '';

    const stock = producto.stock || producto.disponible || 0;
    document.getElementById('liveProductStock').textContent = `${stock} disponible${stock !== 1 ? 's' : ''}`;

    // Resetear contador a 60 segundos
    liveSecondsRemaining = 60;
    updateCountdownDisplay();

    // Quitar clase urgent si quedó
    const countdownBadge = document.getElementById('liveCountdown');
    if (countdownBadge) {
        countdownBadge.classList.remove('urgent');
    }

    // Mostrar modal
    modal.classList.add('active');
    modal.classList.remove('closing');
    document.body.style.overflow = 'hidden';

    // Vibrar dispositivo si es posible
    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
    }

    // Iniciar countdown
    startLiveCountdown();
}

function startLiveCountdown() {
    // Limpiar intervalo anterior si existe
    if (liveCountdownInterval) {
        clearInterval(liveCountdownInterval);
    }

    liveCountdownInterval = setInterval(() => {
        liveSecondsRemaining--;
        updateCountdownDisplay();

        // Añadir clase urgente en últimos 10 segundos
        if (liveSecondsRemaining <= 10) {
            const countdownBadge = document.getElementById('liveCountdown');
            if (countdownBadge) {
                countdownBadge.classList.add('urgent');
            }
        }

        // Cerrar modal cuando llegue a 0
        if (liveSecondsRemaining <= 0) {
            closeLiveModal();
        }
    }, 1000);
}

function updateCountdownDisplay() {
    const countdownEl = document.getElementById('countdownTime');
    if (!countdownEl) return;

    const minutes = Math.floor(liveSecondsRemaining / 60);
    const seconds = liveSecondsRemaining % 60;
    countdownEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function closeLiveModal() {
    const modal = document.getElementById('liveModal');
    if (!modal) return;

    // Limpiar countdown
    if (liveCountdownInterval) {
        clearInterval(liveCountdownInterval);
        liveCountdownInterval = null;
    }

    // Animación de cierre
    modal.classList.add('closing');

    setTimeout(() => {
        modal.classList.remove('active', 'closing');
        document.body.style.overflow = '';

        // Resetear countdown badge
        const countdownBadge = document.getElementById('liveCountdown');
        if (countdownBadge) {
            countdownBadge.classList.remove('urgent');
        }

        currentLiveProduct = null;
    }, 300);
}

function apartarProductoLive() {
    if (!currentLiveProduct || !currentBusiness) {
        console.error('No hay producto o negocio activo');
        return;
    }

    const producto = currentLiveProduct;

    // Construir mensaje para WhatsApp (mismo formato que catálogo regular)
    const mensaje = `APARTADO_WEB
NegocioId: ${currentBusiness}
Producto: ${producto.codigo || producto.id}
Nombre: ${producto.nombre}
Precio: S/${parseFloat(producto.precio).toFixed(2)}`;

    // Cerrar modal primero
    closeLiveModal();

    // Redirigir a WhatsApp
    window.open(`https://wa.me/${APARTALO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`, '_blank');
}

// Actualizar stock en tiempo real
function updateProductStock(productCode, remainingStock) {
    // Actualizar en array local
    const product = products.find(p => p.codigo === productCode || p.id === productCode);
    if (product) {
        product.disponible = remainingStock;
        product.stock = remainingStock;

        // Re-renderizar productos para mostrar cambio
        renderProducts(products);
    }

    // Si el modal del live está abierto con este producto, actualizarlo
    if (currentLiveProduct && (currentLiveProduct.codigo === productCode || currentLiveProduct.id === productCode)) {
        document.getElementById('liveProductStock').textContent = `${remainingStock} disponible${remainingStock !== 1 ? 's' : ''}`;

        // Si se agotó, cerrar modal
        if (remainingStock <= 0) {
            closeLiveModal();
        }
    }
}

// Cerrar modal con ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeProductModal();
        closeLiveModal();
    }
});

// Cerrar modal al hacer clic fuera
document.getElementById('productModal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('product-modal')) {
        closeProductModal();
    }
});

// Limpiar intervalos cuando la página se oculta (ahorro de recursos)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        clearAllImageRotations();
    } else {
        // Re-renderizar para reiniciar las rotaciones
        if (products.length > 0) {
            renderProducts(products);
        }
    }
});

// Iniciar cuando carga la página
document.addEventListener('DOMContentLoaded', init);

