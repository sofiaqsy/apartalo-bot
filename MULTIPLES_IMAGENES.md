# 📸 Múltiples Imágenes por Producto - Cambios Implementados

## ✅ Funcionalidades Agregadas

### 1. Soporte para Múltiples Imágenes
- Ahora cada producto puede tener **varias imágenes**
- Las imágenes se almacenan en la columna `imagenUrl` separadas por `|`
- Ejemplo: `url1|url2|url3`

### 2. Al Editar un Producto
- Se muestra una **galería de imágenes existentes**
- Cada imagen tiene un botón ❌ para eliminarla
- Las imágenes eliminadas se quitan al guardar

### 3. Agregar Nuevas Imágenes
- Botón "📷 Agregar Imágenes" permite seleccionar múltiples archivos
- Vista previa de las nuevas imágenes antes de subir
- Las nuevas imágenes se agregan a las existentes

### 4. Proceso de Guardado
- Primero se suben las imágenes nuevas a Google Drive
- Luego se combinan con las existentes (menos las eliminadas)
- Se muestra progreso: "Subiendo imagen 1/3..."

## 📱 Interfaz de Usuario

### Galería de Imágenes Existentes
```
📷 Imágenes actuales:
┌─────┐ ┌─────┐ ┌─────┐
│ 📷1 │ │ 📷2 │ │ 📷3 │
│  ❌ │ │  ❌ │ │  ❌ │
└─────┘ └─────┘ └─────┘
```

### Nuevas Imágenes a Agregar
```
➕ Nuevas imágenes a agregar:
┌─────┐ ┌─────┐
│ 🆕1 │ │ 🆕2 │  (borde verde punteado)
│  ❌ │ │  ❌ │
└─────┘ └─────┘
```

## 🔧 Cambios Técnicos

### admin.html
- Variables de estado para manejar imágenes:
  - `existingImageUrls[]` - URLs ya guardadas
  - `newImageFiles[]` - Archivos nuevos a subir
  - `imagesToDelete[]` - URLs a eliminar

- Nuevas funciones:
  - `resetImageState()` - Limpia el estado de imágenes
  - `renderExistingImages()` - Muestra galería de imágenes existentes
  - `removeExistingImage(index)` - Elimina imagen existente
  - `previewNewImages(input)` - Preview de nuevas imágenes
  - `renderNewImagePreviews()` - Renderiza previews
  - `removeNewImage(index)` - Quita imagen nueva del preview
  - `updateHiddenImageField()` - Actualiza campo oculto

### Estructura de Datos (Google Sheets)
```
Inventario!G (imagenUrl):
url1|url2|url3
```

## 🚀 Despliegue

Para aplicar los cambios:

```bash
cd "/Users/keylacusi/Desktop/OPEN IA/apartalo-bot"
git add public/admin.html
git commit -m "feat: Soporte para múltiples imágenes por producto"
git push heroku main
```

O si usas Heroku CLI directamente:
```bash
heroku restart -a apartalo
```

## 📝 Notas

1. Las imágenes se suben a Google Drive en la carpeta configurada
2. El formato de URL es `https://drive.google.com/thumbnail?id=XXX&sz=w1000`
3. En la lista de productos se muestra indicador: `PL01 - Monstera (3 📷)`
4. En el LIVE Commerce se muestra solo la primera imagen
