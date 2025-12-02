#!/bin/bash

# Script de testing para Landing ApartaLo
# Verifica que todos los componentes estén funcionando

echo "🧪 TESTING APARTALO LANDING"
echo "=============================="
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000"

# Función para test
test_endpoint() {
    local name=$1
    local endpoint=$2
    local method=$3
    local data=$4
    
    echo -n "Testing $name... "
    
    if [ "$method" == "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" == "200" ]; then
        echo -e "${GREEN}✓ OK${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL (HTTP $http_code)${NC}"
        echo "Response: $body"
        return 1
    fi
}

# Tests
echo "1. Verificando archivos..."
files=(
    "public/index.html"
    "public/css/landing.css"
    "public/js/landing.js"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "   ${GREEN}✓${NC} $file"
    else
        echo -e "   ${RED}✗${NC} $file ${RED}(NO ENCONTRADO)${NC}"
    fi
done

echo ""
echo "2. Probando endpoints API..."

# Test 1: GET /api/businesses
test_endpoint "GET /api/businesses" "/api/businesses" "GET"

# Test 2: GET /api/products/:businessId (necesita businessId real)
# test_endpoint "GET /api/products" "/api/products/cafe01" "GET"

# Test 3: POST /api/apartar
# test_data='{
#   "businessId": "cafe01",
#   "productId": "CAF01",
#   "productoNombre": "Test Product",
#   "precio": 50
# }'
# test_endpoint "POST /api/apartar" "/api/apartar" "POST" "$test_data"

echo ""
echo "3. Verificando servidor..."
if curl -s "$BASE_URL" > /dev/null; then
    echo -e "${GREEN}✓${NC} Servidor respondiendo en $BASE_URL"
else
    echo -e "${RED}✗${NC} Servidor no responde"
    echo "   Ejecuta: npm start"
fi

echo ""
echo "=============================="
echo "🎯 PRUEBAS MANUALES:"
echo ""
echo "1. Abrir en navegador: $BASE_URL"
echo "2. Verificar que carguen negocios"
echo "3. Click en un negocio"
echo "4. Verificar que carguen productos"
echo "5. Verificar timer (60 segundos)"
echo "6. Click en APARTALO"
echo "7. Verificar redirección a WhatsApp"
echo ""
echo "🔗 LINK COMPARTIBLE:"
echo "   $BASE_URL/?business=NEGOCIO_ID"
echo ""
echo "✅ Testing completo!"
