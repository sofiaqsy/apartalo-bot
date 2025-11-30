/**
 * WhatsApp Cloud API Service
 * Envio de mensajes y manejo de la API de WhatsApp Business
 */

const axios = require('axios');
const config = require('./config');

class WhatsAppService {
    constructor() {
        this.token = config.whatsapp.token;
        this.phoneId = config.whatsapp.phoneId;
        this.apiVersion = config.whatsapp.apiVersion;
        this.apiUrl = config.whatsapp.apiUrl;
        this.isDevelopment = config.app.isDevelopment;
    }
    
    cleanPhone(phone) {
        return phone.replace('whatsapp:', '').replace('+', '').replace(/[^0-9]/g, '');
    }
    
    async sendMessage(to, message) {
        const phoneNumber = this.cleanPhone(to);
        
        if (this.isDevelopment) {
            console.log('\n' + '='.repeat(60));
            console.log('📤 MENSAJE (MODO DEV)');
            console.log('Para:', phoneNumber);
            console.log('-'.repeat(60));
            console.log(message);
            console.log('='.repeat(60) + '\n');
            return { status: 'simulated' };
        }
        
        try {
            const url = `${this.apiUrl}/${this.apiVersion}/${this.phoneId}/messages`;
            
            const payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: phoneNumber,
                type: 'text',
                text: {
                    preview_url: false,
                    body: message
                }
            };
            
            const response = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log(`✅ Mensaje enviado a ${phoneNumber}`);
            return response.data;
            
        } catch (error) {
            console.error('❌ Error enviando mensaje:', error.response?.data || error.message);
            return null;
        }
    }
    
    async sendButtonMessage(to, bodyText, buttons) {
        const phoneNumber = this.cleanPhone(to);
        
        if (this.isDevelopment) {
            console.log('\n' + '='.repeat(60));
            console.log('📤 MENSAJE CON BOTONES (MODO DEV)');
            console.log('Para:', phoneNumber);
            console.log('Texto:', bodyText.substring(0, 100) + '...');
            console.log('Botones:', buttons.map(b => b.title).join(', '));
            console.log('='.repeat(60) + '\n');
            return { status: 'simulated' };
        }
        
        try {
            const url = `${this.apiUrl}/${this.apiVersion}/${this.phoneId}/messages`;
            
            const whatsappButtons = buttons.slice(0, 3).map((btn, idx) => ({
                type: 'reply',
                reply: {
                    id: btn.id || `btn_${idx}`,
                    title: btn.title.substring(0, 20)
                }
            }));
            
            const payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: phoneNumber,
                type: 'interactive',
                interactive: {
                    type: 'button',
                    body: { text: bodyText },
                    action: { buttons: whatsappButtons }
                }
            };
            
            const response = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log(`✅ Mensaje interactivo enviado a ${phoneNumber}`);
            return response.data;
            
        } catch (error) {
            console.error('❌ Error enviando mensaje interactivo:', error.response?.data || error.message);
            return await this.sendMessage(to, bodyText);
        }
    }
    
    async sendListMessage(to, options) {
        const phoneNumber = this.cleanPhone(to);
        
        if (this.isDevelopment) {
            console.log('\n' + '='.repeat(60));
            console.log('📤 LISTA INTERACTIVA (MODO DEV)');
            console.log('Para:', phoneNumber);
            console.log('Header:', options.header);
            console.log('Body:', options.body);
            console.log('Secciones:', options.sections?.length || 0);
            console.log('='.repeat(60) + '\n');
            return { status: 'simulated' };
        }
        
        try {
            const url = `${this.apiUrl}/${this.apiVersion}/${this.phoneId}/messages`;
            
            const payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: phoneNumber,
                type: 'interactive',
                interactive: {
                    type: 'list',
                    header: {
                        type: 'text',
                        text: options.header || 'Selecciona una opcion'
                    },
                    body: {
                        text: options.body || 'Elige de la lista'
                    },
                    action: {
                        button: options.buttonText || 'Ver opciones',
                        sections: options.sections
                    }
                }
            };
            
            if (options.footer) {
                payload.interactive.footer = { text: options.footer };
            }
            
            const response = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log(`✅ Lista enviada a ${phoneNumber}`);
            return response.data;
            
        } catch (error) {
            console.error('❌ Error enviando lista:', error.response?.data || error.message);
            return null;
        }
    }
    
    async sendImageMessage(to, imageUrl, caption = '') {
        const phoneNumber = this.cleanPhone(to);
        
        if (this.isDevelopment) {
            console.log('\n' + '='.repeat(60));
            console.log('📸 IMAGEN (MODO DEV)');
            console.log('Para:', phoneNumber);
            console.log('URL:', imageUrl);
            console.log('Caption:', caption);
            console.log('='.repeat(60) + '\n');
            return { status: 'simulated' };
        }
        
        try {
            const url = `${this.apiUrl}/${this.apiVersion}/${this.phoneId}/messages`;
            
            const payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: phoneNumber,
                type: 'image',
                image: {
                    link: imageUrl
                }
            };
            
            if (caption) {
                payload.image.caption = caption;
            }
            
            const response = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log(`✅ Imagen enviada a ${phoneNumber}`);
            return response.data;
            
        } catch (error) {
            console.error('❌ Error enviando imagen:', error.response?.data || error.message);
            return null;
        }
    }
    
    async markAsRead(messageId) {
        if (this.isDevelopment) return;
        
        try {
            const url = `${this.apiUrl}/${this.apiVersion}/${this.phoneId}/messages`;
            
            await axios.post(url, {
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: messageId
            }, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            // Silenciar error de marcar como leido
        }
    }
    
    async downloadMedia(mediaId) {
        try {
            // Paso 1: Obtener URL del media
            const mediaUrl = `${this.apiUrl}/${this.apiVersion}/${mediaId}`;
            const mediaResponse = await axios.get(mediaUrl, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            const fileUrl = mediaResponse.data.url;
            const mimeType = mediaResponse.data.mime_type;
            
            // Paso 2: Descargar el archivo
            const fileResponse = await axios.get(fileUrl, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                responseType: 'arraybuffer'
            });
            
            console.log(`✅ Media descargado: ${mediaId}`);
            
            return {
                success: true,
                buffer: fileResponse.data,
                mimeType: mimeType
            };
            
        } catch (error) {
            console.error('❌ Error descargando media:', error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new WhatsAppService();
