// Estado global
let currentBusiness = null;
let currentViewers = 7;
let currentProductIndex = 0;
let mainTimer = null;
let businesses = {};
let products = [];

// Inicializar app
async function init() {
    // Verificar si hay businessId en URL
    const urlParams = new URLSearchParams(window.location.search);
    const businessId = urlParams.get('business');
    
    if (businessId) {
        // Cargar directamente los productos de ese negocio
        await openBusinessDirect(businessId);
    } else {
        // Cargar lista de negocios
        await loadBusinesses();
    }
    
    // Actualizar viewers cada 3 segundos
    setInterval(updateViewers, 3000);
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
        grid.innerHTML = '<p style="text-align: center; color: #9ca3af;">No hay negocios en vivo ahora</p>';
        return;
    }
    
    grid.innerHTML = businessList.map(business => `
        <div class="business-card" onclick="openBusiness('${business.id}')">
            <img src="${business.imagen || '/icon-192.svg'}" class="business-image" onerror="this.src='/icon-192.svg'">
            <div class="business-info">
                <h3 class="business-name">${business.nombre}</h3>
                <p class="business-desc">${business.descripcion || 'Productos únicos en vivo'}</p>
                <div class="business-stats">
                    <div class="live-pulse"></div>
                    <span class="viewer-stat">${getRandomViewers()}</span>
                    <span class="viewer-label">viendo ahora</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Abrir negocio desde home
async function openBusiness(businessId) {
    currentBusiness = businessId;
    currentProductIndex = 0;
    
    // Actualizar URL sin recargar
    const url = new URL(window.location);
    url.searchParams.set('business', businessId);
    window.history.pushState({}, '', url);
    
    await loadProducts(businessId);
}

// Abrir negocio directo desde URL
async function openBusinessDirect(businessId) {
    currentBusiness = businessId;
    currentProductIndex = 0;
    
    // Ocultar home y mostrar products
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
            renderProducts(data.products, data.business);
            
            // Cambiar de vista
            document.getElementById('homeView').classList.remove('active');
            document.getElementById('productsView').classList.add('active');
            document.getElementById('productsView').scrollTop = 0;
            
            // Iniciar timer
            startMainTimer();
        } else {
            showError('Error cargando productos');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Error de conexión');
    }
}

// Renderizar productos
function renderProducts(productList, business) {
    const feed = document.getElementById('productsFeed');
    
    if (productList.length === 0) {
        feed.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #9ca3af;">
                <p>No hay productos disponibles en este momento</p>
                <button onclick="goBack()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--primary); border: none; border-radius: 8px; color: white; cursor: pointer;">Volver</button>
            </div>
        `;
        return;
    }
    
    feed.innerHTML = productList.map((product, index) => `
        <div class="product-item" id="product-${index}">
            <div class="product-bg">
                <img src="${product.imagen || '/icon-192.svg'}" class="product-bg-image" onerror="this.src='/icon-192.svg'">
                <div class="product-bg-gradient"></div>
            </div>
            
            <div class="product-top-bar">
                <div class="business-info-top">
                    <img src="${business.imagen || '/icon-192.svg'}" class="business-avatar" onerror="this.src='/icon-192.svg'">
                    <span class="business-name-top">${business.nombre}</span>
                </div>
                <a href="${business.tiktok || '#'}" target="_blank" class="tiktok-button" ${!business.tiktok ? 'style="display:none"' : ''}>
                    Ver TikTok →
                </a>
            </div>
            
            <div class="timer-badge" id="timer-badge-${index}">
                <div class="timer-left">
                    <span>Quedan</span>
                    <span class="timer-value" id="timer-${index}">60</span>
                    <span>seg</span>
                </div>
                <div class="timer-viewers">
                    <span id="timer-viewers-${index}">${currentViewers}</span>
                    <span>viendo</span>
                </div>
            </div>
            
            <div class="product-info">
                <h2 class="product-name">${product.nombre}</h2>
                <div class="product-price">S/${parseFloat(product.precio).toFixed(2)}</div>
                <p class="product-desc">${product.descripcion || 'Producto único disponible'}</p>
                <button 
                    class="apartalo-button" 
                    onclick="apartarProducto(${index})"
                    ${product.estado === 'apartado' ? 'disabled' : ''}
                >
                    ${product.estado === 'apartado' ? '✓ APARTADO' : 'APARTALO'}
                </button>
            </div>
        </div>
    `).join('');
}

// Timer principal
function startMainTimer() {
    stopMainTimer();
    
    let timeLeft = 60;
    
    mainTimer = setInterval(() => {
        timeLeft--;
        
        const timerEl = document.getElementById(`timer-${currentProductIndex}`);
        const badgeEl = document.getElementById(`timer-badge-${currentProductIndex}`);
        
        if (timerEl) {
            timerEl.textContent = timeLeft;
            
            if (timeLeft <= 10 && badgeEl) {
                badgeEl.classList.add('urgent');
            } else if (badgeEl) {
                badgeEl.classList.remove('urgent');
            }
        }
        
        if (timeLeft <= 0) {
            currentProductIndex = (currentProductIndex + 1) % products.length;
            scrollToProduct(currentProductIndex);
            timeLeft = 60;
        }
    }, 1000);
}

function stopMainTimer() {
    if (mainTimer) {
        clearInterval(mainTimer);
        mainTimer = null;
    }
}

// Scroll a producto
function scrollToProduct(index) {
    const product = document.getElementById(`product-${index}`);
    if (product) {
        product.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Apartar producto
async function apartarProducto(index) {
    const product = products[index];
    const btn = document.querySelector(`#product-${index} .apartalo-button`);
    
    // Deshabilitar botón
    btn.disabled = true;
    btn.textContent = 'Procesando...';
    
    try {
        const response = await fetch('/api/apartar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                businessId: currentBusiness,
                productId: product.id,
                productoNombre: product.nombre,
                precio: product.precio
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            btn.classList.add('reserved');
            btn.textContent = '✓ APARTADO';
            
            // Mostrar overlay
            document.getElementById('winnerOverlay').classList.add('show');
            
            // Countdown y redirección a WhatsApp
            let countdown = 3;
            const timerEl = document.getElementById('nextTimer');
            
            const countdownInterval = setInterval(() => {
                countdown--;
                timerEl.textContent = countdown;
                
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                    document.getElementById('winnerOverlay').classList.remove('show');
                    
                    // Redirigir a WhatsApp
                    if (data.whatsappUrl) {
                        window.location.href = data.whatsappUrl;
                    }
                    
                    // Avanzar al siguiente producto
                    currentProductIndex = (index + 1) % products.length;
                    scrollToProduct(currentProductIndex);
                }
            }, 1000);
        } else {
            btn.disabled = false;
            btn.textContent = 'APARTALO';
            showError(data.error || 'Error al apartar producto');
        }
    } catch (error) {
        console.error('Error:', error);
        btn.disabled = false;
        btn.textContent = 'APARTALO';
        showError('Error de conexión');
    }
}

// Volver al home
function goBack() {
    stopMainTimer();
    
    // Limpiar URL
    const url = new URL(window.location);
    url.searchParams.delete('business');
    window.history.pushState({}, '', url);
    
    // Cambiar vista
    document.getElementById('productsView').classList.remove('active');
    document.getElementById('homeView').classList.add('active');
    window.scrollTo(0, 0);
}

// Compartir link
function shareLink() {
    const url = window.location.href;
    
    if (navigator.share) {
        navigator.share({
            title: 'ApartaLo - Live Shopping',
            text: '¡Mira estos productos únicos en vivo!',
            url: url
        }).catch(err => console.log('Error sharing:', err));
    } else {
        // Copiar al portapapeles
        navigator.clipboard.writeText(url).then(() => {
            alert('¡Link copiado al portapapeles!');
        }).catch(err => {
            console.error('Error copying:', err);
        });
    }
}

// Actualizar viewers
function updateViewers() {
    const change = Math.random() > 0.5 ? 1 : -1;
    currentViewers = Math.max(3, Math.min(20, currentViewers + change));
    
    document.querySelectorAll('[id^="timer-viewers-"]').forEach(el => {
        el.textContent = currentViewers;
    });
}

// Helpers
function getRandomViewers() {
    return Math.floor(Math.random() * 15) + 5;
}

function showError(message) {
    alert(message);
}

// Iniciar cuando carga la página
document.addEventListener('DOMContentLoaded', init);
