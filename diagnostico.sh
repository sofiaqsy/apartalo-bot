#!/bin/bash

echo "🔍 DIAGNÓSTICO APARTALO-BOT"
echo "============================="
echo ""

cd "/Users/keylacusi/Desktop/OPEN IA/apartalo-bot"

echo "📁 Archivos JS en raíz:"
ls -la *.js 2>/dev/null || echo "   No hay archivos .js en la raíz"
echo ""

echo "📋 Procfile (Heroku):"
cat Procfile 2>/dev/null || echo "   ❌ No existe Procfile"
echo ""

echo "📦 Package.json (scripts):"
cat package.json 2>/dev/null | grep -A 10 "scripts" || echo "   ❌ No existe package.json"
echo ""

echo "🗂️ Estructura del proyecto:"
tree -L 2 -I 'node_modules' . 2>/dev/null || find . -maxdepth 2 -type f -name "*.js" | grep -v node_modules
echo ""

echo "✅ Archivos creados para landing:"
echo "   - landing-api.js:"
[ -f "landing-api.js" ] && echo "     ✓ Existe" || echo "     ✗ NO EXISTE"

echo "   - public/index.html:"
[ -f "public/index.html" ] && echo "     ✓ Existe" || echo "     ✗ NO EXISTE"

echo "   - public/css/landing.css:"
[ -f "public/css/landing.css" ] && echo "     ✓ Existe" || echo "     ✗ NO EXISTE"

echo "   - public/js/landing.js:"
[ -f "public/js/landing.js" ] && echo "     ✓ Existe" || echo "     ✗ NO EXISTE"

echo ""
echo "🌐 Probar endpoints:"
echo "   https://apartalo-63f30bbcbb4a.herokuapp.com/api/businesses"
echo "   https://apartalo-63f30bbcbb4a.herokuapp.com/api/public/negocios"
echo ""

echo "📌 PRÓXIMO PASO:"
echo "   1. Identifica el archivo principal del servidor arriba"
echo "   2. Abre ese archivo y agrega:"
echo "      const landingApi = require('./landing-api');"
echo "      app.use('/', landingApi);"
echo "   3. git add . && git commit -m 'fix api' && git push heroku main"
