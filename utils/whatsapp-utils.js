/**
 * Utilidades para WhatsApp
 */

/**
 * Construir link de WhatsApp con mensaje pre-armado de consulta
 * @param {string} telefono - Número de teléfono del negocio
 * @param {Object} pedidoData - Datos del pedido
 * @returns {string} - Link de WhatsApp
 */
function construirLinkWhatsAppConsulta(telefono, pedidoData) {
    // Limpiar teléfono (solo números)
    let numeroLimpio = telefono.replace(/\D/g, '');

    // Agregar código de país si no lo tiene
    if (!numeroLimpio.startsWith('51')) {
        numeroLimpio = '51' + numeroLimpio;
    }

    // Construir mensaje de consulta con resumen
    const precio = typeof pedidoData.precio === 'number'
        ? pedidoData.precio.toFixed(2)
        : pedidoData.precio;

    const mensaje = `Hola, tengo una consulta sobre mi pedido:

Pedido: ${pedidoData.pedidoId || 'N/A'}
Producto: ${pedidoData.productoNombre || 'N/A'}
Precio: S/${precio}
Cliente: ${pedidoData.cliente || 'N/A'}

Mi consulta es:`;

    // Codificar mensaje para URL
    const mensajeCodificado = encodeURIComponent(mensaje);

    // Construir link
    return `https://wa.me/${numeroLimpio}?text=${mensajeCodificado}`;
}

/**
 * Construir link de WhatsApp simple
 * @param {string} telefono - Número de teléfono
 * @param {string} mensaje - Mensaje a enviar
 * @returns {string} - Link de WhatsApp
 */
function construirLinkWhatsApp(telefono, mensaje = '') {
    let numeroLimpio = telefono.replace(/\D/g, '');

    if (!numeroLimpio.startsWith('51')) {
        numeroLimpio = '51' + numeroLimpio;
    }

    if (mensaje) {
        return `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;
    }

    return `https://wa.me/${numeroLimpio}`;
}

module.exports = {
    construirLinkWhatsAppConsulta,
    construirLinkWhatsApp
};
