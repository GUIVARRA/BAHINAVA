import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from 'baileys';
import deployAsPremium from '../utils/DigixV.js';
import configmanager from '../utils/configmanager.js';
import pino from 'pino';
import fs from 'fs';

const data = 'sessionData';

async function connectToWhatsapp(handleMessage) {
    const { version } = await fetchLatestBaileysVersion();

    const { state, saveCreds } = await useMultiFileAuthState(data);

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        syncFullHistory: true,
        markOnlineOnConnect: true,
        logger: pino({ level: 'silent' }),
        keepAliveIntervalMs: 15000,
        connectTimeoutMs: 60000,
        generateHighQualityLinkPreview: true,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const reason = lastDisconnect?.error?.toString() || 'unknown';

            console.log('❌ Disconnected:', reason, 'StatusCode:', statusCode);

            const shouldReconnect =
                statusCode !== DisconnectReason.loggedOut;

            if (shouldReconnect) {
                console.log('🔄 Reconnecting in 5 seconds...');
                setTimeout(() => connectToWhatsapp(handleMessage), 5000);
            } else {
                console.log('🚫 Logged out. Delete session and restart.');
            }

        } else if (connection === 'connecting') {
            console.log('⏳ Connecting to WhatsApp...');

        } else if (connection === 'open') {
            console.log('✅ WhatsApp Connected Successfully!');

            // =========================
            // 🔐 PAIRING CODE SYSTEM
            // =========================
            if (!state.creds.registered) {
                try {
                    console.log('⚠️ Not logged in, generating pairing code...');

                    const number = "18297010740"; // 🔥 CHANGE THIS NUMBER

                    console.log(`🔄 Requesting pairing code for ${number}`);

                    const code = await sock.requestPairingCode(number);

                    console.log('📲 Pairing Code:', code);
                    console.log('👉 Enter this code in WhatsApp > Linked Devices');

                } catch (err) {
                    console.error('❌ Pairing Error:', err);
                }
            }

            // =========================
            // 📩 WELCOME MESSAGE
            // =========================
            try {
                const chatId = '18297010740@s.whatsapp.net'; // 🔥 CHANGE THIS
                const imagePath = './database/DigixCo.jpg';

                const messageText = `
╔══════════════════╗
   *BAHINAVA-MD Bot Connected* 🚀
╠══════════════════╣
> "Always Forward."
╚══════════════════╝
                `;

                await sock.sendMessage(chatId, {
                    image: fs.existsSync(imagePath) ? { url: imagePath } : undefined,
                    caption: messageText,
                });

                console.log('📩 Welcome message sent');

            } catch (err) {
                console.error('❌ Error sending welcome message:', err);
            }

            // =========================
            // 📥 MESSAGE LISTENER
            // =========================
            sock.ev.on('messages.upsert', async (msg) => {
                handleMessage(sock, msg);
            });
        }
    });

    return sock;
}

export default connectToWhatsapp;
