/**
 * WhatsApp Webhook Route
 * Recibe y procesa mensajes de WhatsApp Cloud API
 */

const express = require('express');
const router = express.Router();
const config = require('./config');
const messageHandler = require('./message-handler');
const whatsappService = require('./whatsapp-service');

router.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    if (mode && token) {
        if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
            console.log('✅ Webhook verificado');
            res.status(200).send(challenge);
        } else {
            console.log('❌ Token de verificacion incorrecto');
            res.sendStatus(403);
        }
    } else {
        res.json({
            status: 'active',
            endpoint: 'webhook',
            timestamp: new Date().toISOString()
        });
    }
});

router.post('/', async (req, res) => {
    try {
        const body = req.body;
        
        if (body.object === 'whatsapp_business_account') {
            if (body.entry && body.entry.length > 0) {
                for (const entry of body.entry) {
                    const changes = entry.changes;
                    
                    if (changes && changes.length > 0) {
                        for (const change of changes) {
                            const value = change.value;
                            
                            if (value.messages && value.messages.length > 0) {
                                const message = value.messages[0];
                                const from = message.from;
                                const messageId = message.id;
                                
                                await whatsappService.markAsRead(messageId);
                                
                                let messageBody = '';
                                let mediaUrl = null;
                                let interactiveData = null;
                                
                                switch (message.type) {
                                    case 'text':
                                        messageBody = message.text.body;
                                        break;
                                        
                                    case 'image':
                                        messageBody = message.image.caption || 'Imagen recibida';
                                        mediaUrl = message.image.id; // ID de la imagen, no URL
                                        break;
                                        
                                    case 'document':
                                        messageBody = message.document.caption || 'Documento recibido';
                                        mediaUrl = message.document.id;
                                        break;
                                        
                                    case 'interactive':
                                        if (message.interactive.type === 'button_reply') {
                                            // Usar el ID del boton, no el titulo
                                            interactiveData = {
                                                type: 'button_reply',
                                                id: message.interactive.button_reply.id,
                                                title: message.interactive.button_reply.title
                                            };
                                            messageBody = message.interactive.button_reply.id;
                                        } else if (message.interactive.type === 'list_reply') {
                                            interactiveData = {
                                                type: 'list_reply',
                                                id: message.interactive.list_reply.id,
                                                title: message.interactive.list_reply.title
                                            };
                                            messageBody = message.interactive.list_reply.id;
                                        }
                                        break;
                                        
                                    default:
                                        messageBody = 'Mensaje no soportado';
                                }
                                
                                console.log(`\n📱 Mensaje de ${from}: ${messageBody}`);
                                if (interactiveData) {
                                    console.log(`   Interactive ID: ${interactiveData.id}`);
                                }
                                if (mediaUrl) {
                                    console.log(`   Media ID: ${mediaUrl}`);
                                }
                                
                                const formattedFrom = `whatsapp:+${from}`;
                                
                                try {
                                    await messageHandler.handleMessage(formattedFrom, messageBody, mediaUrl, interactiveData);
                                } catch (error) {
                                    console.error('❌ Error procesando mensaje:', error);
                                }
                            }
                            
                            if (value.statuses && value.statuses.length > 0) {
                                const status = value.statuses[0];
                                console.log(`📊 Status: ${status.status} para mensaje ${status.id}`);
                            }
                        }
                    }
                }
            }
            
            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error('❌ Error en webhook:', error);
        res.sendStatus(200);
    }
});

module.exports = router;
