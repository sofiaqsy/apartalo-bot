# 📦 Catálogo de Productos - Landing Page Simplificada

## ✅ Cambios Realizados

### Removido
- ❌ Todo lo relacionado con "Live Shopping"
- ❌ Timer de 60 segundos por producto
- ❌ Contador de "personas viendo"
- ❌ Formato de scroll vertical tipo TikTok
- ❌ Texto "En Vivo Ahora"
- ❌ Pulso rojo de live

### Nuevo Diseño

**Vista Home:**
- Título: "ApartaLo" con subtítulo "Catálogo de productos"
- Sección: "Negocios" (en lugar de "En Vivo Ahora")
- Cards de negocios sin contador de viewers

**Vista Catálogo:**
- Grid de productos responsive (2-5 columnas según pantalla)
- Cada producto muestra:
  - Imagen principal
  - Badge "Disponible" o "Agotado"
  - Contador de imágenes si hay más de una
  - Nombre del producto
  - Precio
  - Descripción (opcional)
  - Botón "🛒 Apartar"

**Modal de Producto:**
- Galería de imágenes con thumbnails
- Información completa del producto
- Stock disponible
- Botón grande "🛒 APARTAR AHORA"

**Colores:**
- Color principal: Verde (#4ade80) en lugar de rojo
- Tema oscuro mantenido

## 📱 Responsive

- **Mobile (< 640px):** 2 columnas
- **Tablet (640-767px):** 3 columnas  
- **Desktop (768-1023px):** 3 columnas
- **Large (1024-1279px):** 4 columnas
- **XL (1280px+):** 5 columnas

## 🔗 URLs

- **Home:** `https://apartalo-63f30bbcbb4a.herokuapp.com/`
- **Negocio específico:** `https://apartalo-63f30bbcbb4a.herokuapp.com/?business=BIZ-001`

## 🚀 Despliegue

```bash
cd "/Users/keylacusi/Desktop/OPEN IA/apartalo-bot"
git add .
git commit -m "feat: Convertir landing a catálogo simple de productos"
git push heroku main
```

## 📁 Archivos Modificados

- `public/index.html` - Nueva estructura HTML
- `public/css/landing.css` - Nuevo diseño CSS
- `public/js/landing.js` - Nueva lógica JavaScript
- `landing-api.js` - API actualizada con campo disponible

## 💡 Funcionalidades

1. **Ver catálogo:** Grid de productos con imágenes
2. **Ver detalle:** Click en producto abre modal con galería
3. **Apartar:** Reserva el producto y redirige a WhatsApp
4. **Compartir:** Botón para compartir link del catálogo
