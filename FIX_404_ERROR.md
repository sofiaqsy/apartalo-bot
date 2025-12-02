# 🚨 FIX RÁPIDO - Error 404 en /api/businesses

## ❌ PROBLEMA ACTUAL

```
GET /api/businesses → 404 (Not Found)
```

El frontend está llamando a rutas que no existen en el servidor.

## ✅ SOLUCIÓN

### OPCIÓN 1: Registrar Nuevas Rutas (RECOMENDADO)

#### Paso 1: Verificar archivo principal del servidor

Busca en tu proyecto el archivo principal (uno de estos):
- `app.js`
- `server.js`
- `index.js`

Debe estar en la raíz del proyecto apartalo-bot.

#### Paso 2: Registrar landing-api.js

Agrega estas líneas en tu archivo principal:

```javascript
// Después de tus otras rutas
const landingApi = require('./landing-api');
app.use('/', landingApi);  // Las rutas ya incluyen el prefijo /api
```

#### Paso 3: Push a Heroku

```bash
cd /Users/keylacusi/Desktop/OPEN\ IA/apartalo-bot
git add landing-api.js
git commit -m "Agregar rutas API para landing"
git push heroku main
```

---

### OPCIÓN 2: Modificar Frontend (MÁS RÁPIDO)

Si no encuentras el archivo principal, modifica el frontend para usar las rutas existentes:

#### Edita: `public/js/landing.js`

Cambia esta línea (aprox línea 28):

```javascript
// ANTES:
const response = await fetch('/api/businesses');

// DESPUÉS:
const response = await fetch('/api/public/negocios');
```

Cambia esta línea (aprox línea 66):

```javascript
// ANTES:
const response = await fetch(`/api/products/${businessId}`);

// DESPUÉS:
const response = await fetch(`/api/public/negocio/${businessId}/inventario`);
```

Cambia esta línea (aprox línea 187):

```javascript
// ANTES:
const response = await fetch('/api/apartar', {

// DESPUÉS:
// Esta ruta no existe, hay que crearla o usar el flujo del live
const response = await fetch('/api/public/apartar', {
```

#### Push cambios:

```bash
cd /Users/keylacusi/Desktop/OPEN\ IA/apartalo-bot/public/js
# Edita landing.js con los cambios de arriba
cd ../..
git add public/js/landing.js
git commit -m "Fix: usar rutas existentes"
git push heroku main
```

---

## 🔍 DEBUGGEAR

### Ver rutas disponibles

Abre la consola de Heroku:

```bash
heroku logs --tail -a apartalo-63f30bbcbb4a
```

### Probar rutas existentes

Prueba estas URLs en tu navegador:

```
https://apartalo-63f30bbcbb4a.herokuapp.com/api/public/negocios
https://apartalo-63f30bbcbb4a.herokuapp.com/api/public/live
```

Si estas funcionan, usa OPCIÓN 2.
Si estas también dan 404, hay un problema más profundo en el servidor.

---

## 📋 CHECKLIST

- [ ] Encontrar archivo principal del servidor (app.js/server.js/index.js)
- [ ] Verificar que landing-api.js está en la raíz
- [ ] Registrar rutas en el archivo principal
- [ ] Hacer commit y push a Heroku
- [ ] Esperar 1-2 minutos para que Heroku redeploy
- [ ] Refrescar navegador
- [ ] Verificar que carguen negocios

---

## 🆘 SI NADA FUNCIONA

### Revisar estructura del servidor

```bash
cd /Users/keylacusi/Desktop/OPEN\ IA/apartalo-bot

# Buscar archivo principal
find . -maxdepth 1 -name "*.js" -type f

# Ver cómo se inicia el servidor
cat Procfile
cat package.json | grep "start"
```

### Crear archivo principal si no existe

Si no tienes `app.js`, crea uno:

```javascript
const express = require('express');
const app = express();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Importar rutas
const publicRoutes = require('./public-routes');
const landingApi = require('./landing-api');

// Registrar rutas
app.use('/api/public', publicRoutes);
app.use('/', landingApi);

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en puerto ${PORT}`);
});
```

---

## 💡 NOTA IMPORTANTE

El archivo **landing-api.js** ya está creado en tu proyecto con todas las rutas necesarias:

- `GET /api/businesses` ✓
- `GET /api/products/:businessId` ✓
- `POST /api/apartar` ✓

Solo falta registrarlo en el archivo principal del servidor.

---

## 🎯 SIGUIENTE PASO

1. Busca el archivo principal del servidor
2. Si no lo encuentras, comparte el output de:
   ```bash
   ls -la /Users/keylacusi/Desktop/OPEN\ IA/apartalo-bot/*.js
   cat /Users/keylacusi/Desktop/OPEN\ IA/apartalo-bot/Procfile
   ```
3. Te ayudaré a crear el archivo faltante
