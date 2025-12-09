// Estado global
let currentBusiness = null;
let currentProduct = null;
let businesses = {};
let products = [];
let imageRotationIntervals = {}; // Para manejar los intervalos de rotación

// Inicializar app
async function init() {
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
    
    const url = new URL(window.location);
    url.searchParams.set('business', businessId);
    window.history.pushState({}, '', url);
    
    await loadProducts(businessId);
}

// Abrir negocio directo desde URL
async function openBusinessDirect(businessId) {
    currentBusiness = businessId;
    
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
        const isAvailable = product.disponible > 0 && product.estado !== 'APARTADO';
        const images = product.imagen ? product.imagen.split('|').filter(i => i) : [];
        const imageCount = images.length;
        const mainImage = images[0] || '/icon-192.svg';
        
        return `
            <div class="product-card ${!isAvailable ? 'sold-out' : ''}" onclick="openProductModal(${index})">
                <div class="product-image-container">
                    <img 
                        src="${mainImage}" 
                        class="product-image" 
                        id="product-img-${index}"
                        onerror="this.src='/icon-192.svg'"
                    >
                    <span class="product-badge ${isAvailable ? 'badge-available' : 'badge-sold'}">
                        ${isAvailable ? 'Disponible' : 'Agotado'}
                    </span>
                    ${imageCount > 1 ? `
                        <div class="image-dots" id="dots-${index}"></div>
                    ` : ''}
                </div>
                <div class="product-details">
                    <h3 class="product-name">${product.nombre}</h3>
                    <div class="product-price">S/${parseFloat(product.precio).toFixed(2)}</div>
                    ${product.descripcion ? `<p class="product-desc">${product.descripcion}</p>` : ''}
                    <button 
                        class="apartalo-btn ${!isAvailable ? 'reserved' : ''}" 
                        onclick="event.stopPropagation(); apartarProducto(${index})"
                        ${!isAvailable ? 'disabled' : ''}
                    >
                        ${isAvailable ? 'APARTAR' : 'AGOTADO'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    // Iniciar rotación para productos con múltiples imágenes
    productList.forEach((product, index) => {
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
    
    currentProduct = { ...product, index };
    
    const modal = document.getElementById('productModal');
    const gallery = document.getElementById('modalGallery');
    const info = document.getElementById('modalInfo');
    
    const images = product.imagen ? product.imagen.split('|').filter(i => i) : [];
    const mainImage = images[0] || '/icon-192.svg';
    const isAvailable = product.disponible > 0 && product.estado !== 'APARTADO';
    
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
        <div class="modal-stock">
            ${isAvailable ? `${product.disponible} disponible${product.disponible > 1 ? 's' : ''}` : 'Sin stock'}
        </div>
        <button 
            class="modal-apartalo-btn" 
            onclick="apartarProducto(${index})"
            ${!isAvailable ? 'disabled' : ''}
        >
            ${isAvailable ? 'APARTAR AHORA' : 'AGOTADO'}
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

// Cerrar modal con ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeProductModal();
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
