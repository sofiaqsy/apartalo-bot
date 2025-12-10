/**
 * Diccionario de ciudades peruanas → Departamentos
 * Usado para detectar automáticamente si el envío es local o nacional
 */

const CIUDADES_DEPARTAMENTOS = {
    // Departamentos directos
    'lima': 'Lima',
    'callao': 'Callao',
    'arequipa': 'Arequipa',
    'cusco': 'Cusco',
    'cuzco': 'Cusco',
    'piura': 'Piura',
    'ica': 'Ica',
    'tacna': 'Tacna',
    'puno': 'Puno',
    'tumbes': 'Tumbes',
    'moquegua': 'Moquegua',
    'ayacucho': 'Ayacucho',
    'huanuco': 'Huánuco',
    'cajamarca': 'Cajamarca',
    'amazonas': 'Amazonas',
    'pasco': 'Pasco',
    'huancavelica': 'Huancavelica',

    // Ciudades principales → Departamento
    'trujillo': 'La Libertad',
    'chiclayo': 'Lambayeque',
    'huancayo': 'Junín',
    'iquitos': 'Loreto',
    'pucallpa': 'Ucayali',
    'tarapoto': 'San Martín',
    'moyobamba': 'San Martín',
    'juliaca': 'Puno',
    'chimbote': 'Áncash',
    'huaraz': 'Áncash',
    'sullana': 'Piura',
    'talara': 'Piura',
    'chincha': 'Ica',
    'nazca': 'Ica',
    'puerto maldonado': 'Madre de Dios',
    'abancay': 'Apurímac',
    'chachapoyas': 'Amazonas',
    'cerro de pasco': 'Pasco',
    'tingo maria': 'Huánuco',

    // Variantes y regiones
    'la libertad': 'La Libertad',
    'lambayeque': 'Lambayeque',
    'junin': 'Junín',
    'san martin': 'San Martín',
    'loreto': 'Loreto',
    'ucayali': 'Ucayali',
    'ancash': 'Áncash',
    'madre de dios': 'Madre de Dios',
    'apurimac': 'Apurímac',
    'ventanilla': 'Callao',

    // Distritos de Lima Metropolitana
    'miraflores': 'Lima',
    'san isidro': 'Lima',
    'san borja': 'Lima',
    'surco': 'Lima',
    'santiago de surco': 'Lima',
    'la molina': 'Lima',
    'san miguel': 'Lima',
    'magdalena': 'Lima',
    'jesus maria': 'Lima',
    'lince': 'Lima',
    'pueblo libre': 'Lima',
    'barranco': 'Lima',
    'chorrillos': 'Lima',
    'surquillo': 'Lima',
    'ate': 'Lima',
    'santa anita': 'Lima',
    'san juan de lurigancho': 'Lima',
    'sjl': 'Lima',
    'los olivos': 'Lima',
    'comas': 'Lima',
    'independencia': 'Lima',
    'san martin de porres': 'Lima',
    'smp': 'Lima',
    'rimac': 'Lima',
    'cercado': 'Lima',
    'cercado de lima': 'Lima',
    'breña': 'Lima',
    'la victoria': 'Lima',
    'san luis': 'Lima',
    'el agustino': 'Lima',
    'villa maria del triunfo': 'Lima',
    'vmt': 'Lima',
    'villa el salvador': 'Lima',
    'ves': 'Lima',
    'san juan de miraflores': 'Lima',
    'sjm': 'Lima',
    'lurin': 'Lima',
    'pachacamac': 'Lima',
    'cieneguilla': 'Lima',
    'chaclacayo': 'Lima',
    'chosica': 'Lima',
    'carabayllo': 'Lima',
    'puente piedra': 'Lima',
    'ancon': 'Lima'
};

/**
 * Detecta el departamento a partir del nombre de una ciudad
 * @param {string} texto - Ciudad o departamento ingresado por el usuario
 * @returns {string|null} - Nombre del departamento o null si no se encuentra
 */
function detectarDepartamento(texto) {
    if (!texto) return null;

    const textoLower = texto.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
        .trim();

    // Buscar coincidencia exacta primero
    if (CIUDADES_DEPARTAMENTOS[textoLower]) {
        return CIUDADES_DEPARTAMENTOS[textoLower];
    }

    // Buscar coincidencia parcial
    for (const [ciudad, depto] of Object.entries(CIUDADES_DEPARTAMENTOS)) {
        const ciudadNorm = ciudad.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (textoLower.includes(ciudadNorm) || ciudadNorm.includes(textoLower)) {
            return depto;
        }
    }

    return null;
}

/**
 * Determina si el envío es local (mismo departamento)
 * @param {string} departamentoNegocio - Departamento del negocio
 * @param {string} departamentoCliente - Departamento del cliente
 * @returns {boolean}
 */
function esEnvioLocal(departamentoNegocio, departamentoCliente) {
    if (!departamentoNegocio || !departamentoCliente) return false;

    const negocioNorm = departamentoNegocio.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const clienteNorm = departamentoCliente.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    // Considerar Lima y Callao como mismo área metropolitana
    const limaMetro = ['lima', 'callao'];
    if (limaMetro.includes(negocioNorm) && limaMetro.includes(clienteNorm)) {
        return true;
    }

    return negocioNorm === clienteNorm;
}

module.exports = {
    CIUDADES_DEPARTAMENTOS,
    detectarDepartamento,
    esEnvioLocal
};
