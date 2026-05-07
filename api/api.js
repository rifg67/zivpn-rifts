const express = require('express');
const fs = require('fs');
const { exec } = require('child_process');
const os = require('os');
const https = require('https');
const http = require('http');

const app = express();
const PORT = 8585;
const CONFIG_FILE = '/etc/zivpn/config.json';
const USER_DB = '/etc/zivpn/users.json';
const DOMAIN_FILE = '/etc/zivpn/domain';
const API_KEY_FILE = '/etc/zivpn/apikey';

// URL untuk mengambil konfigurasi Telegram
const TELEGRAM_TOKEN_URL = 'https://pxstore.web.id/bot-token';
const TELEGRAM_ID_URL = 'https://pxstore.web.id/bot-id';

// Variabel Global
let AUTH_TOKEN = 'PX-DefaultKey12345678';
let TELEGRAM_BOT_TOKEN = '';
let TELEGRAM_CHAT_ID = '';
let TELEGRAM_ENABLED = true;

// Fungsi untuk mengambil data dari URL
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data.trim()));
        }).on('error', (err) => {
            console.error(`Error fetching ${url}:`, err.message);
            reject(err);
        });
    });
}

// Fungsi untuk mengambil konfigurasi Telegram dari link
async function loadTelegramConfig() {
    try {
        console.log('📡 Mengambil konfigurasi Telegram dari server...');
        
        const [botToken, chatId] = await Promise.all([
            fetchUrl(TELEGRAM_TOKEN_URL),
            fetchUrl(TELEGRAM_ID_URL)
        ]);
        
        if (botToken && botToken.length > 0 && chatId && chatId.length > 0) {
            TELEGRAM_BOT_TOKEN = botToken;
            TELEGRAM_CHAT_ID = chatId;
            TELEGRAM_ENABLED = true;
            console.log('✅ Konfigurasi Telegram berhasil dimuat');
            console.log(`   Bot Token: ${TELEGRAM_BOT_TOKEN.substring(0, 10)}...`);
            console.log(`   Chat ID: ${TELEGRAM_CHAT_ID}`);
            return true;
        } else {
            console.log('⚠️ Gagal mengambil konfigurasi Telegram');
            TELEGRAM_ENABLED = false;
            return false;
        }
    } catch (error) {
        console.error('❌ Error loading Telegram config:', error.message);
        TELEGRAM_ENABLED = false;
        return false;
    }
}

// Load API Key
function loadApiKey() {
    if (fs.existsSync(API_KEY_FILE)) {
        try {
            AUTH_TOKEN = fs.readFileSync(API_KEY_FILE, 'utf8').trim();
            console.log('✅ API Key loaded from file');
        } catch(e) {
            console.log('⚠️ Using default API Key');
        }
    } else {
        console.log('⚠️ No API key file found, using default');
    }
}

// Fungsi kirim notifikasi ke Telegram
async function sendTelegramNotification(message) {
    if (!TELEGRAM_ENABLED || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.log('⚠️ Telegram notifikasi dinonaktifkan (config tidak lengkap)');
        return false;
    }
    
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const postData = JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
    });
    
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    
    return new Promise((resolve) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result.ok === true);
                } catch(e) {
                    resolve(false);
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('Telegram notification failed:', error.message);
            resolve(false);
        });
        
        req.write(postData);
        req.end();
    });
}

// Format pesan untuk user create
function formatCreateMessage(userData, action = 'CREATED') {
    const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    
    return `
<b>🔔 ZIVPN ACCOUNT ${action}</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Password:</b> <code>${userData.password}</code>
<b>Expired:</b> ${userData.expired}
<b>IP Limit:</b> ${userData.ip_limit}
<b>Domain:</b> <code>${userData.domain}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>Waktu:</b> ${timestamp}
<b>Status:</b> Berhasil dibuat
    `.trim();
}

// Format pesan untuk trial
function formatTrialMessage(userData) {
    const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const expiredTime = new Date(userData.expired).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    
    return `
<b>⏰ TRIAL ACCOUNT CREATED</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Password:</b> <code>${userData.password}</code>
<b>Expired:</b> ${expiredTime}
<b>IP Limit:</b> ${userData.ip_limit}
<b>Domain:</b> <code>${userData.domain}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>Waktu:</b> ${timestamp}
<b>Catatan:</b> Trial berlaku 30 menit
    `.trim();
}

// Format pesan untuk renew user
function formatRenewMessage(userData, oldExpired, newExpired, daysAdded) {
    const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    
    return `
<b>🔄 ZIVPN ACCOUNT RENEWED</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Password:</b> <code>${userData.password}</code>
<b>Expired Sebelum:</b> ${oldExpired}
<b>Expired Baru:</b> ${newExpired}
<b>IP Limit:</b> ${userData.ip_limit}
<b>Domain:</b> <code>${userData.domain}</code>
<b>Durasi Tambahan:</b> ${daysAdded} hari
━━━━━━━━━━━━━━━━━━━━━
<b>Waktu:</b> ${timestamp}
<b>Status:</b> ✅ Berhasil diperpanjang
    `.trim();
}

// Format pesan untuk auto renew reminder
function formatAutoRenewReminder(userData, daysRemaining) {
    const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    
    return `
<b>⚠️ PERINGATAN EXPIRED ACCOUNT</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Password:</b> <code>${userData.password}</code>
<b>Expired:</b> ${userData.expired}
<b>Sisa Waktu:</b> ${daysRemaining} hari lagi
<b>IP Limit:</b> ${userData.ip_limit}
━━━━━━━━━━━━━━━━━━━━━
<b>Waktu:</b> ${timestamp}
<b>⚠️ Segera lakukan renew agar akun tidak expired!</b>
    `.trim();
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Debug middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Auth middleware
function authMiddleware(req, res, next) {
    const token = req.headers['x-api-key'];
    
    // Debug logging
    console.log('===================================');
    console.log('Auth Debug:');
    console.log('Received token:', token);
    console.log('Expected token:', AUTH_TOKEN);
    console.log('Token type:', typeof token);
    console.log('Expected type:', typeof AUTH_TOKEN);
    console.log('Token length:', token ? token.length : 'null');
    console.log('Expected length:', AUTH_TOKEN ? AUTH_TOKEN.length : 'null');
    console.log('Match:', token === AUTH_TOKEN);
    console.log('===================================');
    
    if (token && token === AUTH_TOKEN) {
        console.log('✅ Auth SUCCESS - Access granted');
        next();
    } else {
        console.log('❌ Auth FAILED - Access denied');
        res.status(401).json({ success: false, message: 'Unauthorized' });
    }
}

// Helper functions
function loadUsers() {
    try {
        if (!fs.existsSync(USER_DB)) return [];
        const data = fs.readFileSync(USER_DB, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

// Fungsi untuk cek dan kirim reminder expired
async function checkAndSendExpiredReminders() {
    const users = loadUsers();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const user of users) {
        if (user.status === 'locked' || user.is_trial) continue;
        
        const expiredDate = new Date(user.expired);
        expiredDate.setHours(0, 0, 0, 0);
        
        const diffTime = expiredDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Kirim reminder untuk 7, 3, dan 1 hari sebelum expired
        if (diffDays === 7 || diffDays === 3 || diffDays === 1) {
            let reminderSent = false;
            if (user.last_reminder_sent !== diffDays) {
                let domain = 'Not set';
                if (fs.existsSync(DOMAIN_FILE)) {
                    domain = fs.readFileSync(DOMAIN_FILE, 'utf8').trim();
                }
                
                const userData = {
                    password: user.password,
                    expired: user.expired,
                    ip_limit: user.ip_limit,
                    domain: domain
                };
                
                const message = formatAutoRenewReminder(userData, diffDays);
                await sendTelegramNotification(message);
                
                // Update reminder sent status
                user.last_reminder_sent = diffDays;
                fs.writeFileSync(USER_DB, JSON.stringify(users, null, 2));
                console.log(`📧 Reminder sent for ${user.password} (${diffDays} days left)`);
            }
        }
    }
}

// Jalankan pengecekan reminder setiap jam
setInterval(() => {
    checkAndSendExpiredReminders();
}, 60 * 60 * 1000); // Setiap 1 jam

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'API is healthy', timestamp: new Date().toISOString() });
});

// ==================== CREATE USER ====================
app.post('/api/user/create', authMiddleware, async (req, res) => {
    const { password, days, ip_limit } = req.body;
    
    if (!password || !days) {
        return res.json({ success: false, message: 'Password and days required' });
    }
    
    const configFile = '/etc/zivpn/config.json';
    let config = { auth: { config: [] } };
    
    if (fs.existsSync(configFile)) {
        try {
            config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        } catch(e) {}
    }
    
    if (config.auth.config.includes(password)) {
        return res.json({ success: false, message: 'User already exists' });
    }
    
    config.auth.config.push(password);
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + parseInt(days));
    const expDateStr = expDate.toISOString().split('T')[0];
    
    const users = loadUsers();
    users.push({
        password: password,
        expired: expDateStr,
        ip_limit: ip_limit || 0,
        status: 'active',
        created_at: new Date().toISOString()
    });
    fs.writeFileSync(USER_DB, JSON.stringify(users, null, 2));
    
    exec('systemctl restart zivpn', () => {});
    
    let domain = 'Not set';
    if (fs.existsSync(DOMAIN_FILE)) {
        domain = fs.readFileSync(DOMAIN_FILE, 'utf8').trim();
    }
    
    const responseData = {
        password: password,
        expired: expDateStr,
        ip_limit: String(ip_limit || 0),
        domain: domain
    };
    
    // Kirim notifikasi Telegram
    const message = formatCreateMessage(responseData, 'CREATE');
    sendTelegramNotification(message).catch(console.error);
    
    res.json({
        success: true,
        data: responseData
    });
});

// ==================== CREATE RANDOM USER ====================
app.post('/api/user/create-random', authMiddleware, async (req, res) => {
    const { days, ip_limit } = req.body;
    const password = 'user_' + Math.random().toString(36).substr(2, 10);
    
    const configFile = '/etc/zivpn/config.json';
    let config = { auth: { config: [] } };
    
    if (fs.existsSync(configFile)) {
        try {
            config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        } catch(e) {}
    }
    
    config.auth.config.push(password);
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + parseInt(days));
    const expDateStr = expDate.toISOString().split('T')[0];
    
    const users = loadUsers();
    users.push({
        password: password,
        expired: expDateStr,
        ip_limit: ip_limit || 0,
        status: 'active',
        created_at: new Date().toISOString()
    });
    fs.writeFileSync(USER_DB, JSON.stringify(users, null, 2));
    
    exec('systemctl restart zivpn', () => {});
    
    let domain = 'Not set';
    if (fs.existsSync(DOMAIN_FILE)) {
        domain = fs.readFileSync(DOMAIN_FILE, 'utf8').trim();
    }
    
    const responseData = {
        password: password,
        expired: expDateStr,
        ip_limit: String(ip_limit || 0),
        domain: domain
    };
    
    // Kirim notifikasi Telegram
    const message = formatCreateMessage(responseData, 'CREATE-RANDOM');
    sendTelegramNotification(message).catch(console.error);
    
    res.json({
        success: true,
        data: responseData
    });
});

// ==================== TRIAL USER ====================
app.post('/api/user/trial', authMiddleware, async (req, res) => {
    const trialPassword = 'trial_' + Math.random().toString(36).substr(2, 8);
    
    const configFile = '/etc/zivpn/config.json';
    let config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    config.auth.config.push(trialPassword);
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    
    const expDate = new Date();
    expDate.setMinutes(expDate.getMinutes() + 30);
    
    const users = loadUsers();
    users.push({
        password: trialPassword,
        expired: expDate.toISOString().split('T')[0],
        expired_time: expDate.toISOString(),
        ip_limit: 1,
        status: 'active',
        is_trial: true,
        created_at: new Date().toISOString()
    });
    fs.writeFileSync(USER_DB, JSON.stringify(users, null, 2));
    
    exec('systemctl restart zivpn', () => {});
    
    let domain = 'Not set';
    if (fs.existsSync(DOMAIN_FILE)) {
        domain = fs.readFileSync(DOMAIN_FILE, 'utf8').trim();
    }
    
    const responseData = {
        password: trialPassword,
        expired: expDate.toISOString(),
        ip_limit: '1',
        domain: domain
    };
    
    // Kirim notifikasi Telegram untuk trial
    const message = formatTrialMessage(responseData);
    sendTelegramNotification(message).catch(console.error);
    
    res.json({
        success: true,
        data: responseData
    });
});

// ==================== RENEW USER ====================
app.post('/api/user/renew', authMiddleware, async (req, res) => {
    const { password, days } = req.body;
    
    if (!password || !days) {
        return res.json({ success: false, message: 'Password and days required' });
    }
    
    const users = loadUsers();
    const userIndex = users.findIndex(u => u.password === password);
    
    if (userIndex === -1) {
        return res.json({ success: false, message: 'User not found' });
    }
    
    const user = users[userIndex];
    const oldExpired = user.expired;
    
    // Hitung expired baru
    let newExpDate;
    const currentExpDate = new Date(user.expired);
    const today = new Date();
    
    if (currentExpDate < today) {
        // Jika sudah expired, mulai dari hari ini
        newExpDate = new Date();
        newExpDate.setDate(newExpDate.getDate() + parseInt(days));
    } else {
        // Jika belum expired, tambahkan dari expired date
        newExpDate = new Date(user.expired);
        newExpDate.setDate(newExpDate.getDate() + parseInt(days));
    }
    
    const newExpiredStr = newExpDate.toISOString().split('T')[0];
    
    // Update user data
    user.expired = newExpiredStr;
    user.status = 'active';
    user.last_renew_at = new Date().toISOString();
    user.renew_count = (user.renew_count || 0) + 1;
    
    fs.writeFileSync(USER_DB, JSON.stringify(users, null, 2));
    
    let domain = 'Not set';
    if (fs.existsSync(DOMAIN_FILE)) {
        domain = fs.readFileSync(DOMAIN_FILE, 'utf8').trim();
    }
    
    const responseData = {
        password: password,
        expired: newExpiredStr,
        ip_limit: String(user.ip_limit || 0),
        domain: domain
    };
    
    // Kirim notifikasi Telegram untuk renew
    const message = formatRenewMessage(responseData, oldExpired, newExpiredStr, days);
    await sendTelegramNotification(message);
    
    res.json({
        success: true,
        message: 'User renewed successfully',
        data: {
            password: password,
            old_expired: oldExpired,
            new_expired: newExpiredStr,
            days_added: parseInt(days)
        }
    });
});

// ==================== RENEW ALL EXPIRED USERS ====================
app.post('/api/user/renew-all-expired', authMiddleware, async (req, res) => {
    const { days } = req.body;
    
    if (!days) {
        return res.json({ success: false, message: 'Days required' });
    }
    
    const users = loadUsers();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let renewedCount = 0;
    const renewedUsers = [];
    
    for (const user of users) {
        const expiredDate = new Date(user.expired);
        expiredDate.setHours(0, 0, 0, 0);
        
        if (expiredDate < today && !user.is_trial) {
            // Renew expired user
            const newExpDate = new Date();
            newExpDate.setDate(newExpDate.getDate() + parseInt(days));
            const newExpiredStr = newExpDate.toISOString().split('T')[0];
            
            const oldExpired = user.expired;
            user.expired = newExpiredStr;
            user.status = 'active';
            user.last_renew_at = new Date().toISOString();
            user.renew_count = (user.renew_count || 0) + 1;
            
            renewedUsers.push({
                password: user.password,
                old_expired: oldExpired,
                new_expired: newExpiredStr
            });
            
            renewedCount++;
        }
    }
    
    if (renewedCount > 0) {
        fs.writeFileSync(USER_DB, JSON.stringify(users, null, 2));
        
        let domain = 'Not set';
        if (fs.existsSync(DOMAIN_FILE)) {
            domain = fs.readFileSync(DOMAIN_FILE, 'utf8').trim();
        }
        
        // Kirim notifikasi ringkasan renew massal
        const summaryMessage = `
<b>🔄 BULK RENEW - EXPIRED ACCOUNTS</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Total Renew:</b> ${renewedCount} akun
<b>Durasi Tambahan:</b> ${days} hari
<b>Domain:</b> <code>${domain}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>Detail Renew:</b>
${renewedUsers.map(u => `• ${u.password}: ${u.old_expired} → ${u.new_expired}`).join('\n')}
━━━━━━━━━━━━━━━━━━━━━
<b>Waktu:</b> ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
        `.trim();
        
        await sendTelegramNotification(summaryMessage);
        
        res.json({
            success: true,
            message: `${renewedCount} expired users renewed successfully`,
            data: {
                total_renewed: renewedCount,
                days_added: parseInt(days),
                renewed_users: renewedUsers
            }
        });
    } else {
        res.json({
            success: true,
            message: 'No expired users found',
            data: {
                total_renewed: 0
            }
        });
    }
});

// ==================== CHECK EXPIRING SOON ====================
app.get('/api/users/expiring-soon', authMiddleware, (req, res) => {
    const { days = 7 } = req.query;
    const users = loadUsers();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const expiringSoon = [];
    
    for (const user of users) {
        if (user.is_trial) continue;
        
        const expiredDate = new Date(user.expired);
        expiredDate.setHours(0, 0, 0, 0);
        
        const diffTime = expiredDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 0 && diffDays <= parseInt(days)) {
            expiringSoon.push({
                password: user.password,
                expired: user.expired,
                days_remaining: diffDays,
                ip_limit: user.ip_limit,
                status: user.status
            });
        }
    }
    
    res.json({
        success: true,
        data: {
            expiring_in_days: parseInt(days),
            total: expiringSoon.length,
            users: expiringSoon.sort((a, b) => a.days_remaining - b.days_remaining)
        }
    });
});

// ==================== TELEGRAM TEST ====================
app.post('/api/telegram/test', authMiddleware, async (req, res) => {
    const testMessage = `
<b>🧪 TEST NOTIFICATION</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Status:</b> ✅ Telegram bot berfungsi
<b>Waktu:</b> ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
━━━━━━━━━━━━━━━━━━━━━
    `.trim();
    
    const sent = await sendTelegramNotification(testMessage);
    res.json({ 
        success: sent, 
        message: sent ? 'Test notification sent' : 'Failed to send notification',
        config: {
            enabled: TELEGRAM_ENABLED,
            has_token: !!TELEGRAM_BOT_TOKEN,
            has_chat_id: !!TELEGRAM_CHAT_ID
        }
    });
});

// ==================== LIST USERS ====================
app.get('/api/users', authMiddleware, (req, res) => {
    const users = loadUsers();
    const today = new Date().toISOString().split('T')[0];
    
    const userList = users.map(u => ({
        password: u.password,
        expired: u.expired,
        status: u.status === 'locked' ? 'Locked' : (u.expired < today ? 'Expired' : 'Active'),
        ip_limit: u.ip_limit,
        renew_count: u.renew_count || 0,
        last_renew: u.last_renew_at || null
    }));
    
    res.json({ success: true, data: userList });
});

// ==================== DELETE USER ====================
app.post('/api/user/delete', authMiddleware, (req, res) => {
    const { password } = req.body;
    
    const configFile = '/etc/zivpn/config.json';
    let config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    config.auth.config = config.auth.config.filter(p => p !== password);
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    
    const users = loadUsers();
    const newUsers = users.filter(u => u.password !== password);
    fs.writeFileSync(USER_DB, JSON.stringify(newUsers, null, 2));
    
    exec('systemctl restart zivpn', () => {});
    
    res.json({ success: true, message: 'User deleted' });
});

// ==================== FUNGSI BANTUAN ====================
async function getSystemInfoForXray() {
    return new Promise((resolve) => {
        const info = {};
        
        exec('curl -s ipinfo.io/org | cut -d " " -f 2-10', (err, stdout) => {
            info.isp = err ? 'Unknown ISP' : stdout.trim() || 'Unknown ISP';
            
            exec('curl -s ipinfo.io/city', (err2, stdout2) => {
                info.city = err2 ? 'Unknown City' : stdout2.trim() || 'Unknown City';
                
                if (fs.existsSync(DOMAIN_FILE)) {
                    info.domain = fs.readFileSync(DOMAIN_FILE, 'utf8').trim();
                } else {
                    info.domain = 'example.com';
                }
                
                exec('curl -sS ipv4.icanhazip.com', (err3, stdout3) => {
                    info.ip = err3 ? 'Unknown IP' : stdout3.trim();
                    resolve(info);
                });
            });
        });
    });
}

// ==================== CREATE TROJAN ====================
app.post('/api/trojan/create', authMiddleware, async (req, res) => {
    try {
        const { username, password, quota, ip_limit, days } = req.body;
        
        if (!username || !days) {
            return res.status(400).json({ success: false, message: 'Username and days required' });
        }
        
        const systemInfo = await getSystemInfoForXray();
        const finalPassword = password || Math.random().toString(36).substr(2, 12);
        const finalQuota = quota || 0;
        const finalIpLimit = ip_limit || 0;
        
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + parseInt(days));
        const expired = expDate.toISOString().split('T')[0];
        const expiredDisplay = expDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        
        // Cek user exist
        const trojanDbPath = '/etc/peyx/trojan.db';
        if (fs.existsSync(trojanDbPath)) {
            const dbContent = fs.readFileSync(trojanDbPath, 'utf8');
            if (dbContent.includes(`### ${username} `)) {
                return res.status(400).json({ success: false, message: 'Username already exists!' });
            }
        }
        
        // Tambah ke Xray config
        const xrayConfig = '/usr/local/etc/xray/config.json';
        if (!fs.existsSync(xrayConfig)) {
            return res.status(400).json({ success: false, message: 'Xray config not found!' });
        }
        
        let config = JSON.parse(fs.readFileSync(xrayConfig, 'utf8'));
        let found = false;
        
        config.inbounds = config.inbounds.map(inbound => {
            if (inbound.protocol === 'trojan') {
                if (!inbound.settings.clients) inbound.settings.clients = [];
                inbound.settings.clients.push({ password: finalPassword, email: username });
                found = true;
            }
            return inbound;
        });
        
        if (!found) {
            return res.status(400).json({ success: false, message: 'Trojan inbound not found!' });
        }
        
        fs.writeFileSync(xrayConfig, JSON.stringify(config, null, 2));
        
        // Set IP limit
        if (finalIpLimit > 0) {
            const limitDir = '/etc/peyx/limit/trojan/ip';
            if (!fs.existsSync(limitDir)) fs.mkdirSync(limitDir, { recursive: true });
            fs.writeFileSync(`/etc/peyx/limit/trojan/ip/${username}`, finalIpLimit.toString());
        }
        
        // Set quota
        if (finalQuota > 0) {
            const quotaDir = '/etc/peyx/trojan';
            if (!fs.existsSync(quotaDir)) fs.mkdirSync(quotaDir, { recursive: true });
            fs.writeFileSync(`/etc/peyx/trojan/${username}`, (finalQuota * 1024 * 1024 * 1024).toString());
        }
        
        // Save to database
        let dbContent = '';
        if (fs.existsSync(trojanDbPath)) {
            dbContent = fs.readFileSync(trojanDbPath, 'utf8');
        }
        dbContent += `### ${username} ${expired} ${finalPassword} ${finalQuota} ${finalIpLimit}\n`;
        fs.writeFileSync(trojanDbPath, dbContent);
        
        exec('systemctl restart xray', () => {});
        
        // Generate links
        const trojanTLS = `trojan://${finalPassword}@${systemInfo.domain}:443?security=tls&type=ws&path=/trojan&sni=${systemInfo.domain}#${username}`;
        const trojanHTTP = `trojan://${finalPassword}@${systemInfo.domain}:80?security=none&type=ws&path=/trojan#${username}`;
        const trojanGRPC = `trojan://${finalPassword}@${systemInfo.domain}:443?security=tls&type=grpc&serviceName=trojan-grpc&sni=${systemInfo.domain}#${username}`;
        
        // Format notifikasi seperti API ZiVPN
        const notificationMessage = `
<b>🔔 TROJAN ACCOUNT CREATED</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Username:</b> <code>${username}</code>
<b>Password:</b> <code>${finalPassword}</code>
<b>Quota:</b> ${finalQuota} GB
<b>IP Limit:</b> ${finalIpLimit}
<b>Expired:</b> ${expiredDisplay}
<b>Domain:</b> <code>${systemInfo.domain}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>🔗 TLS (443):</b>
<code>${trojanTLS}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>🔗 HTTP (80):</b>
<code>${trojanHTTP}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>🔗 GRPC:</b>
<code>${trojanGRPC}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>Waktu:</b> ${timestamp}
<b>Status:</b> ✅ Berhasil dibuat
        `.trim();
        
        await sendTelegramNotification(notificationMessage);
        
        res.json({
            success: true,
            message: 'Trojan account created successfully',
            data: {
                username, password: finalPassword, quota: finalQuota,
                ip_limit: finalIpLimit, expired: expiredDisplay,
                domain: systemInfo.domain,
                links: { tls: trojanTLS, http: trojanHTTP, grpc: trojanGRPC }
            }
        });
        
    } catch (error) {
        console.error('Error creating Trojan:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== RENEW TROJAN ====================
app.post('/api/trojan/renew', authMiddleware, async (req, res) => {
    try {
        const { username, days, quota, ip_limit } = req.body;
        
        if (!username || !days) {
            return res.status(400).json({ success: false, message: 'Username and days required' });
        }
        
        const trojanDbPath = '/etc/peyx/trojan.db';
        
        if (!fs.existsSync(trojanDbPath)) {
            return res.status(404).json({ success: false, message: 'Trojan database not found!' });
        }
        
        let dbContent = fs.readFileSync(trojanDbPath, 'utf8');
        const lines = dbContent.split('\n');
        let userLineIndex = -1;
        let userLine = '';
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith(`### ${username} `)) {
                userLineIndex = i;
                userLine = lines[i];
                break;
            }
        }
        
        if (userLineIndex === -1) {
            return res.status(404).json({ success: false, message: 'Username not found!' });
        }
        
        const parts = userLine.split(' ');
        const oldExpired = parts[2];
        const password = parts[3];
        const oldQuota = parts[4] || 0;
        const oldIpLimit = parts[5] || 0;
        
        const newQuota = quota !== undefined ? quota : parseInt(oldQuota);
        const newIpLimit = ip_limit !== undefined ? ip_limit : parseInt(oldIpLimit);
        
        const oldExpDate = new Date(oldExpired);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let newExpired;
        if (oldExpDate < today) {
            newExpired = new Date();
            newExpired.setDate(newExpired.getDate() + parseInt(days));
        } else {
            newExpired = new Date(oldExpired);
            newExpired.setDate(newExpired.getDate() + parseInt(days));
        }
        
        const newExpiredStr = newExpired.toISOString().split('T')[0];
        const oldExpiredDisplay = new Date(oldExpired).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const newExpiredDisplay = newExpired.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        
        if (newIpLimit > 0) {
            const limitDir = '/etc/peyx/limit/trojan/ip';
            if (!fs.existsSync(limitDir)) fs.mkdirSync(limitDir, { recursive: true });
            fs.writeFileSync(`/etc/peyx/limit/trojan/ip/${username}`, newIpLimit.toString());
        }
        
        if (newQuota > 0) {
            const quotaDir = '/etc/peyx/trojan';
            if (!fs.existsSync(quotaDir)) fs.mkdirSync(quotaDir, { recursive: true });
            fs.writeFileSync(`/etc/peyx/trojan/${username}`, (newQuota * 1024 * 1024 * 1024).toString());
        }
        
        lines[userLineIndex] = `### ${username} ${newExpiredStr} ${password} ${newQuota} ${newIpLimit}`;
        fs.writeFileSync(trojanDbPath, lines.join('\n'));
        
        exec('systemctl restart xray', () => {});
        
        // Format notifikasi seperti API ZiVPN
        const notificationMessage = `
<b>🔄 TROJAN ACCOUNT RENEWED</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Username:</b> <code>${username}</code>
<b>Quota:</b> ${newQuota} GB
<b>IP Limit:</b> ${newIpLimit}
<b>Expired Sebelum:</b> ${oldExpiredDisplay}
<b>Expired Baru:</b> ${newExpiredDisplay}
<b>Durasi Tambahan:</b> ${days} hari
━━━━━━━━━━━━━━━━━━━━━
<b>Waktu:</b> ${timestamp}
<b>Status:</b> ✅ Berhasil diperpanjang
        `.trim();
        
        await sendTelegramNotification(notificationMessage);
        
        res.json({
            success: true,
            message: 'Trojan account renewed successfully',
            data: {
                username, old_expired: oldExpiredDisplay,
                new_expired: newExpiredDisplay, days_added: parseInt(days),
                quota: newQuota, ip_limit: newIpLimit
            }
        });
        
    } catch (error) {
        console.error('Error renewing Trojan:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== DELETE TROJAN ====================
app.post('/api/trojan/delete', authMiddleware, async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({ success: false, message: 'Username required' });
        }
        
        const trojanDbPath = '/etc/peyx/trojan.db';
        
        if (!fs.existsSync(trojanDbPath)) {
            return res.status(404).json({ success: false, message: 'Trojan database not found!' });
        }
        
        let dbContent = fs.readFileSync(trojanDbPath, 'utf8');
        const lines = dbContent.split('\n');
        let userLineIndex = -1;
        let quota = 0, iplimit = 0, expired = '';
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith(`### ${username} `)) {
                userLineIndex = i;
                const parts = lines[i].split(' ');
                expired = parts[2];
                quota = parts[4] || 0;
                iplimit = parts[5] || 0;
                break;
            }
        }
        
        if (userLineIndex === -1) {
            return res.status(404).json({ success: false, message: 'Username not found!' });
        }
        
        // Hapus dari Xray config
        const xrayConfig = '/usr/local/etc/xray/config.json';
        if (fs.existsSync(xrayConfig)) {
            let config = JSON.parse(fs.readFileSync(xrayConfig, 'utf8'));
            
            config.inbounds = config.inbounds.map(inbound => {
                if (inbound.protocol === 'trojan' && inbound.settings.clients) {
                    inbound.settings.clients = inbound.settings.clients.filter(client => client.email !== username);
                }
                return inbound;
            });
            
            fs.writeFileSync(xrayConfig, JSON.stringify(config, null, 2));
        }
        
        lines.splice(userLineIndex, 1);
        fs.writeFileSync(trojanDbPath, lines.join('\n'));
        
        const expiredDisplay = new Date(expired).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        
        // Format notifikasi seperti API ZiVPN
        const notificationMessage = `
<b>🗑️ TROJAN ACCOUNT DELETED</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Username:</b> <code>${username}</code>
<b>Quota:</b> ${quota} GB
<b>IP Limit:</b> ${iplimit}
<b>Expired:</b> ${expiredDisplay}
━━━━━━━━━━━━━━━━━━━━━
<b>Waktu:</b> ${timestamp}
<b>Status:</b> ✅ Berhasil dihapus
        `.trim();
        
        await sendTelegramNotification(notificationMessage);
        
        // Hapus file
        try {
            fs.unlinkSync(`/etc/peyx/limit/trojan/ip/${username}`);
            fs.unlinkSync(`/etc/peyx/trojan/${username}`);
            fs.unlinkSync(`/var/www/html/trojan-${username}.txt`);
        } catch(e) {}
        
        exec('systemctl restart xray', () => {});
        
        res.json({
            success: true,
            message: 'Trojan account deleted successfully',
            data: { username, expired: expiredDisplay, quota, ip_limit: iplimit }
        });
        
    } catch (error) {
        console.error('Error deleting Trojan:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== TRIAL TROJAN ====================
// ==================== TRIAL TROJAN ====================
app.post('/api/trojan/trial', authMiddleware, async (req, res) => {
    try {
        const { username, password, minutes } = req.body;
        
        if (!username || !minutes) {
            return res.status(400).json({ success: false, message: 'Username and minutes required' });
        }
        
        // Validasi minutes (min 1, max 60)
        if (minutes < 1 || minutes > 60) {
            return res.status(400).json({ success: false, message: 'Minutes must be between 1 and 60' });
        }
        
        const systemInfo = await getSystemInfoForXray();
        
        // UNIVERSAL: Gunakan password dari request jika ada, jika tidak generate random
        let finalPassword;
        if (password && password.length >= 4) {
            finalPassword = password;
            console.log(`✅ Using custom password for trial Trojan: ${username}`);
        } else {
            finalPassword = Math.random().toString(36).substr(2, 8);
            console.log(`✅ Using generated password for trial Trojan: ${username}`);
        }
        
        const finalQuota = 1;
        const finalIpLimit = 1;
        
        const expDate = new Date();
        expDate.setMinutes(expDate.getMinutes() + parseInt(minutes));
        const expired = expDate.toISOString();
        const expiredDisplay = expDate.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        
        // Cek user exist di database trial
        const trojanDbPath = '/etc/peyx/trojan_trial.db';
        if (fs.existsSync(trojanDbPath)) {
            const dbContent = fs.readFileSync(trojanDbPath, 'utf8');
            if (dbContent.includes(`### ${username} `)) {
                return res.status(400).json({ success: false, message: 'Username already exists!' });
            }
        }
        
        // Tambah ke Xray config
        const xrayConfig = '/usr/local/etc/xray/config.json';
        if (!fs.existsSync(xrayConfig)) {
            return res.status(400).json({ success: false, message: 'Xray config not found!' });
        }
        
        let config = JSON.parse(fs.readFileSync(xrayConfig, 'utf8'));
        let found = false;
        
        config.inbounds = config.inbounds.map(inbound => {
            if (inbound.protocol === 'trojan') {
                if (!inbound.settings.clients) inbound.settings.clients = [];
                inbound.settings.clients.push({ password: finalPassword, email: username });
                found = true;
            }
            return inbound;
        });
        
        if (!found) {
            return res.status(400).json({ success: false, message: 'Trojan inbound not found!' });
        }
        
        fs.writeFileSync(xrayConfig, JSON.stringify(config, null, 2));
        
        // Set IP limit
        if (finalIpLimit > 0) {
            const limitDir = '/etc/peyx/limit/trojan/ip';
            if (!fs.existsSync(limitDir)) fs.mkdirSync(limitDir, { recursive: true });
            fs.writeFileSync(`/etc/peyx/limit/trojan/ip/${username}`, finalIpLimit.toString());
        }
        
        // Save to trial database
        let dbContent = '';
        if (fs.existsSync(trojanDbPath)) {
            dbContent = fs.readFileSync(trojanDbPath, 'utf8');
        }
        dbContent += `### ${username} ${expired} ${finalPassword} ${finalQuota} ${finalIpLimit}\n`;
        fs.writeFileSync(trojanDbPath, dbContent);
        
        // Auto delete script
        const deleteScript = `/usr/local/bin/delete_trial_trojan_${username}.sh`;
        const scriptContent = `#!/bin/bash
jq --arg user "${username}" '.inbounds |= map(if .protocol == "trojan" then .settings.clients |= map(select(.email != \$user)) else . end)' /usr/local/etc/xray/config.json > /usr/local/etc/xray/config.json.tmp && mv /usr/local/etc/xray/config.json.tmp /usr/local/etc/xray/config.json
rm -f /etc/peyx/limit/trojan/ip/${username}
rm -f /var/www/html/trojan-${username}.txt
sed -i "/### ${username} /d" /etc/peyx/trojan_trial.db
systemctl restart xray
rm -f ${deleteScript}`;
        
        fs.writeFileSync(deleteScript, scriptContent);
        fs.chmodSync(deleteScript, '755');
        
        exec(`echo "${deleteScript}" | at now + ${minutes} minutes`, () => {});
        exec('systemctl restart xray', () => {});
        
        // Generate links
        const trojanTLS = `trojan://${finalPassword}@${systemInfo.domain}:443?security=tls&type=ws&path=/trojan&host=${systemInfo.domain}&sni=${systemInfo.domain}#${username}`;
        const trojanHTTP = `trojan://${finalPassword}@${systemInfo.domain}:80?security=none&type=ws&path=/trojan&host=${systemInfo.domain}#${username}`;
        const trojanGRPC = `trojan://${finalPassword}@${systemInfo.domain}:443?security=tls&type=grpc&serviceName=trojan-grpc&host=${systemInfo.domain}&sni=${systemInfo.domain}#${username}`;
        
        const notificationMessage = `
<b>⏰ TRIAL TROJAN ACCOUNT</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Username:</b> <code>${username}</code>
<b>Password:</b> <code>${finalPassword}</code>
<b>Quota:</b> ${finalQuota} GB
<b>IP Limit:</b> ${finalIpLimit}
<b>Expired:</b> ${expiredDisplay}
<b>Domain:</b> <code>${systemInfo.domain}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>🔗 TLS (443):</b>
<code>${trojanTLS}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>🔗 HTTP (80):</b>
<code>${trojanHTTP}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>🔗 GRPC:</b>
<code>${trojanGRPC}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>📅 Waktu:</b> ${timestamp}
<b>Catatan:</b> Trial berlaku ${minutes} menit
        `.trim();
        
        await sendTelegramNotification(notificationMessage);
        
        res.json({
            success: true,
            message: 'Trial Trojan account created successfully',
            data: {
                username: username,
                password: finalPassword,
                quota: finalQuota,
                ip_limit: finalIpLimit,
                expired: expiredDisplay,
                duration_minutes: parseInt(minutes),
                domain: systemInfo.domain,
                links: { tls: trojanTLS, http: trojanHTTP, grpc: trojanGRPC }
            }
        });
        
    } catch (error) {
        console.error('Error creating trial Trojan:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== CREATE VLESS ====================
app.post('/api/vless/create', authMiddleware, async (req, res) => {
    try {
        const { username, uuid, quota, ip_limit, days } = req.body;
        
        if (!username || !days) {
            return res.status(400).json({ success: false, message: 'Username and days required' });
        }
        
        const systemInfo = await getSystemInfoForXray();
        const finalUuid = uuid || require('crypto').randomUUID();
        const finalQuota = quota || 0;
        const finalIpLimit = ip_limit || 0;
        
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + parseInt(days));
        const expired = expDate.toISOString().split('T')[0];
        const expiredDisplay = expDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        
        const vlessDbPath = '/etc/peyx/vless.db';
        if (fs.existsSync(vlessDbPath)) {
            const dbContent = fs.readFileSync(vlessDbPath, 'utf8');
            if (dbContent.includes(`### ${username} `)) {
                return res.status(400).json({ success: false, message: 'Username already exists!' });
            }
        }
        
        const xrayConfig = '/usr/local/etc/xray/config.json';
        if (!fs.existsSync(xrayConfig)) {
            return res.status(400).json({ success: false, message: 'Xray config not found!' });
        }
        
        let config = JSON.parse(fs.readFileSync(xrayConfig, 'utf8'));
        let found = false;
        
        config.inbounds = config.inbounds.map(inbound => {
            if (inbound.protocol === 'vless') {
                if (!inbound.settings.clients) inbound.settings.clients = [];
                inbound.settings.clients.push({ id: finalUuid, email: username });
                found = true;
            }
            return inbound;
        });
        
        if (!found) {
            return res.status(400).json({ success: false, message: 'VLESS inbound not found!' });
        }
        
        fs.writeFileSync(xrayConfig, JSON.stringify(config, null, 2));
        
        if (finalIpLimit > 0) {
            const limitDir = '/etc/peyx/limit/vless/ip';
            if (!fs.existsSync(limitDir)) fs.mkdirSync(limitDir, { recursive: true });
            fs.writeFileSync(`/etc/peyx/limit/vless/ip/${username}`, finalIpLimit.toString());
        }
        
        if (finalQuota > 0) {
            const quotaDir = '/etc/peyx/vless';
            if (!fs.existsSync(quotaDir)) fs.mkdirSync(quotaDir, { recursive: true });
            fs.writeFileSync(`/etc/peyx/vless/${username}`, (finalQuota * 1024 * 1024 * 1024).toString());
        }
        
        let dbContent = '';
        if (fs.existsSync(vlessDbPath)) {
            dbContent = fs.readFileSync(vlessDbPath, 'utf8');
        }
        dbContent += `### ${username} ${expired} ${finalUuid} ${finalQuota} ${finalIpLimit}\n`;
        fs.writeFileSync(vlessDbPath, dbContent);
        
        exec('systemctl restart xray', () => {});
        
        const vlessTLS = `vless://${finalUuid}@${systemInfo.domain}:443?encryption=none&security=tls&type=ws&host=${systemInfo.domain}&path=/vless&sni=${systemInfo.domain}#${username}`;
        const vlessHTTP = `vless://${finalUuid}@${systemInfo.domain}:80?encryption=none&security=none&type=ws&host=${systemInfo.domain}&path=/vless#${username}`;
        const vlessGRPC = `vless://${finalUuid}@${systemInfo.domain}:443?encryption=none&security=tls&type=grpc&serviceName=vless-grpc&sni=${systemInfo.domain}#${username}`;
        
        const notificationMessage = `
<b>🔔 VLESS ACCOUNT CREATED</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Username:</b> <code>${username}</code>
<b>UUID:</b> <code>${finalUuid}</code>
<b>Quota:</b> ${finalQuota} GB
<b>IP Limit:</b> ${finalIpLimit}
<b>Expired:</b> ${expiredDisplay}
<b>Domain:</b> <code>${systemInfo.domain}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>🔗 TLS (443):</b>
<code>${vlessTLS}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>🔗 HTTP (80):</b>
<code>${vlessHTTP}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>🔗 GRPC:</b>
<code>${vlessGRPC}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>Waktu:</b> ${timestamp}
<b>Status:</b> ✅ Berhasil dibuat
        `.trim();
        
        await sendTelegramNotification(notificationMessage);
        
        res.json({
            success: true,
            message: 'VLESS account created successfully',
            data: {
                username, uuid: finalUuid, quota: finalQuota,
                ip_limit: finalIpLimit, expired: expiredDisplay,
                domain: systemInfo.domain,
                links: { tls: vlessTLS, http: vlessHTTP, grpc: vlessGRPC }
            }
        });
        
    } catch (error) {
        console.error('Error creating VLESS:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== RENEW VLESS ====================
app.post('/api/vless/renew', authMiddleware, async (req, res) => {
    try {
        const { username, days, quota, ip_limit } = req.body;
        
        if (!username || !days) {
            return res.status(400).json({ success: false, message: 'Username and days required' });
        }
        
        const vlessDbPath = '/etc/peyx/vless.db';
        
        if (!fs.existsSync(vlessDbPath)) {
            return res.status(404).json({ success: false, message: 'VLESS database not found!' });
        }
        
        let dbContent = fs.readFileSync(vlessDbPath, 'utf8');
        const lines = dbContent.split('\n');
        let userLineIndex = -1;
        let userLine = '';
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith(`### ${username} `)) {
                userLineIndex = i;
                userLine = lines[i];
                break;
            }
        }
        
        if (userLineIndex === -1) {
            return res.status(404).json({ success: false, message: 'Username not found!' });
        }
        
        const parts = userLine.split(' ');
        const oldExpired = parts[2];
        const uuid = parts[3];
        const oldQuota = parts[4] || 0;
        const oldIpLimit = parts[5] || 0;
        
        const newQuota = quota !== undefined ? quota : parseInt(oldQuota);
        const newIpLimit = ip_limit !== undefined ? ip_limit : parseInt(oldIpLimit);
        
        const oldExpDate = new Date(oldExpired);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let newExpired;
        if (oldExpDate < today) {
            newExpired = new Date();
            newExpired.setDate(newExpired.getDate() + parseInt(days));
        } else {
            newExpired = new Date(oldExpired);
            newExpired.setDate(newExpired.getDate() + parseInt(days));
        }
        
        const newExpiredStr = newExpired.toISOString().split('T')[0];
        const oldExpiredDisplay = new Date(oldExpired).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const newExpiredDisplay = newExpired.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        
        if (newIpLimit > 0) {
            const limitDir = '/etc/peyx/limit/vless/ip';
            if (!fs.existsSync(limitDir)) fs.mkdirSync(limitDir, { recursive: true });
            fs.writeFileSync(`/etc/peyx/limit/vless/ip/${username}`, newIpLimit.toString());
        }
        
        if (newQuota > 0) {
            const quotaDir = '/etc/peyx/vless';
            if (!fs.existsSync(quotaDir)) fs.mkdirSync(quotaDir, { recursive: true });
            fs.writeFileSync(`/etc/peyx/vless/${username}`, (newQuota * 1024 * 1024 * 1024).toString());
        }
        
        lines[userLineIndex] = `### ${username} ${newExpiredStr} ${uuid} ${newQuota} ${newIpLimit}`;
        fs.writeFileSync(vlessDbPath, lines.join('\n'));
        
        exec('systemctl restart xray', () => {});
        
        const notificationMessage = `
<b>🔄 VLESS ACCOUNT RENEWED</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Username:</b> <code>${username}</code>
<b>Quota:</b> ${newQuota} GB
<b>IP Limit:</b> ${newIpLimit}
<b>Expired Sebelum:</b> ${oldExpiredDisplay}
<b>Expired Baru:</b> ${newExpiredDisplay}
<b>Durasi Tambahan:</b> ${days} hari
━━━━━━━━━━━━━━━━━━━━━
<b>Waktu:</b> ${timestamp}
<b>Status:</b> ✅ Berhasil diperpanjang
        `.trim();
        
        await sendTelegramNotification(notificationMessage);
        
        res.json({
            success: true,
            message: 'VLESS account renewed successfully',
            data: {
                username, old_expired: oldExpiredDisplay,
                new_expired: newExpiredDisplay, days_added: parseInt(days),
                quota: newQuota, ip_limit: newIpLimit
            }
        });
        
    } catch (error) {
        console.error('Error renewing VLESS:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== DELETE VLESS ====================
app.post('/api/vless/delete', authMiddleware, async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({ success: false, message: 'Username required' });
        }
        
        const vlessDbPath = '/etc/peyx/vless.db';
        
        if (!fs.existsSync(vlessDbPath)) {
            return res.status(404).json({ success: false, message: 'VLESS database not found!' });
        }
        
        let dbContent = fs.readFileSync(vlessDbPath, 'utf8');
        const lines = dbContent.split('\n');
        let userLineIndex = -1;
        let quota = 0, iplimit = 0, expired = '';
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith(`### ${username} `)) {
                userLineIndex = i;
                const parts = lines[i].split(' ');
                expired = parts[2];
                quota = parts[4] || 0;
                iplimit = parts[5] || 0;
                break;
            }
        }
        
        if (userLineIndex === -1) {
            return res.status(404).json({ success: false, message: 'Username not found!' });
        }
        
        const xrayConfig = '/usr/local/etc/xray/config.json';
        if (fs.existsSync(xrayConfig)) {
            let config = JSON.parse(fs.readFileSync(xrayConfig, 'utf8'));
            
            config.inbounds = config.inbounds.map(inbound => {
                if (inbound.protocol === 'vless' && inbound.settings.clients) {
                    inbound.settings.clients = inbound.settings.clients.filter(client => client.email !== username);
                }
                return inbound;
            });
            
            fs.writeFileSync(xrayConfig, JSON.stringify(config, null, 2));
        }
        
        lines.splice(userLineIndex, 1);
        fs.writeFileSync(vlessDbPath, lines.join('\n'));
        
        const expiredDisplay = new Date(expired).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        
        const notificationMessage = `
<b>🗑️ VLESS ACCOUNT DELETED</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Username:</b> <code>${username}</code>
<b>Quota:</b> ${quota} GB
<b>IP Limit:</b> ${iplimit}
<b>Expired:</b> ${expiredDisplay}
━━━━━━━━━━━━━━━━━━━━━
<b>Waktu:</b> ${timestamp}
<b>Status:</b> ✅ Berhasil dihapus
        `.trim();
        
        await sendTelegramNotification(notificationMessage);
        
        try {
            fs.unlinkSync(`/etc/peyx/limit/vless/ip/${username}`);
            fs.unlinkSync(`/etc/peyx/vless/${username}`);
            fs.unlinkSync(`/var/www/html/vless-${username}.txt`);
        } catch(e) {}
        
        exec('systemctl restart xray', () => {});
        
        res.json({
            success: true,
            message: 'VLESS account deleted successfully',
            data: { username, expired: expiredDisplay, quota, ip_limit: iplimit }
        });
        
    } catch (error) {
        console.error('Error deleting VLESS:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== TRIAL VLESS ====================
// ==================== TRIAL VLESS ====================
app.post('/api/vless/trial', authMiddleware, async (req, res) => {
    try {
        const { username, password, minutes } = req.body;
        
        if (!username || !minutes) {
            return res.status(400).json({ success: false, message: 'Username and minutes required' });
        }
        
        if (minutes < 1 || minutes > 60) {
            return res.status(400).json({ success: false, message: 'Minutes must be between 1 and 60' });
        }
        
        const systemInfo = await getSystemInfoForXray();
        
        // UNIVERSAL: Gunakan password dari request sebagai UUID, jika tidak generate random
        let finalUuid;
        if (password && password.length >= 4) {
            finalUuid = password;
            console.log(`✅ Using custom UUID for VLess trial: ${username}`);
        } else {
            finalUuid = require('crypto').randomUUID();
            console.log(`✅ Using generated UUID for VLess trial: ${username}`);
        }
        
        const finalQuota = 1;
        const finalIpLimit = 1;
        
        const expDate = new Date();
        expDate.setMinutes(expDate.getMinutes() + parseInt(minutes));
        const expired = expDate.toISOString();
        const expiredDisplay = expDate.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        
        const vlessDbPath = '/etc/peyx/vless_trial.db';
        if (fs.existsSync(vlessDbPath)) {
            const dbContent = fs.readFileSync(vlessDbPath, 'utf8');
            if (dbContent.includes(`### ${username} `)) {
                return res.status(400).json({ success: false, message: 'Username already exists!' });
            }
        }
        
        const xrayConfig = '/usr/local/etc/xray/config.json';
        if (!fs.existsSync(xrayConfig)) {
            return res.status(400).json({ success: false, message: 'Xray config not found!' });
        }
        
        let config = JSON.parse(fs.readFileSync(xrayConfig, 'utf8'));
        let found = false;
        
        config.inbounds = config.inbounds.map(inbound => {
            if (inbound.protocol === 'vless') {
                if (!inbound.settings.clients) inbound.settings.clients = [];
                inbound.settings.clients.push({ id: finalUuid, email: username });
                found = true;
            }
            return inbound;
        });
        
        if (!found) {
            return res.status(400).json({ success: false, message: 'VLESS inbound not found!' });
        }
        
        fs.writeFileSync(xrayConfig, JSON.stringify(config, null, 2));
        
        if (finalIpLimit > 0) {
            const limitDir = '/etc/peyx/limit/vless/ip';
            if (!fs.existsSync(limitDir)) fs.mkdirSync(limitDir, { recursive: true });
            fs.writeFileSync(`/etc/peyx/limit/vless/ip/${username}`, finalIpLimit.toString());
        }
        
        let dbContent = '';
        if (fs.existsSync(vlessDbPath)) {
            dbContent = fs.readFileSync(vlessDbPath, 'utf8');
        }
        dbContent += `### ${username} ${expired} ${finalUuid} ${finalQuota} ${finalIpLimit}\n`;
        fs.writeFileSync(vlessDbPath, dbContent);
        
        const deleteScript = `/usr/local/bin/delete_trial_vless_${username}.sh`;
        const scriptContent = `#!/bin/bash
jq --arg user "${username}" '.inbounds |= map(if .protocol == "vless" then .settings.clients |= map(select(.email != \$user)) else . end)' /usr/local/etc/xray/config.json > /usr/local/etc/xray/config.json.tmp && mv /usr/local/etc/xray/config.json.tmp /usr/local/etc/xray/config.json
rm -f /etc/peyx/limit/vless/ip/${username}
rm -f /var/www/html/vless-${username}.txt
sed -i "/### ${username} /d" /etc/peyx/vless_trial.db
systemctl restart xray
rm -f ${deleteScript}`;
        
        fs.writeFileSync(deleteScript, scriptContent);
        fs.chmodSync(deleteScript, '755');
        
        exec(`echo "${deleteScript}" | at now + ${minutes} minutes`, () => {});
        exec('systemctl restart xray', () => {});
        
        const vlessTLS = `vless://${finalUuid}@${systemInfo.domain}:443?encryption=none&security=tls&type=ws&host=${systemInfo.domain}&path=/vless&sni=${systemInfo.domain}#${username}`;
        const vlessHTTP = `vless://${finalUuid}@${systemInfo.domain}:80?encryption=none&security=none&type=ws&host=${systemInfo.domain}&path=/vless#${username}`;
        const vlessGRPC = `vless://${finalUuid}@${systemInfo.domain}:443?encryption=none&security=tls&type=grpc&serviceName=vless-grpc&sni=${systemInfo.domain}#${username}`;
        
        const notificationMessage = `
<b>⏰ TRIAL VLESS ACCOUNT</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Username:</b> <code>${username}</code>
<b>UUID:</b> <code>${finalUuid}</code>
<b>Quota:</b> ${finalQuota} GB
<b>IP Limit:</b> ${finalIpLimit}
<b>Expired:</b> ${expiredDisplay}
<b>Domain:</b> <code>${systemInfo.domain}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>🔗 TLS (443):</b>
<code>${vlessTLS}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>🔗 HTTP (80):</b>
<code>${vlessHTTP}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>🔗 GRPC:</b>
<code>${vlessGRPC}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>📅 Waktu:</b> ${timestamp}
<b>Catatan:</b> Trial berlaku ${minutes} menit
        `.trim();
        
        await sendTelegramNotification(notificationMessage);
        
        res.json({
            success: true,
            message: 'Trial VLESS account created successfully',
            data: {
                username, uuid: finalUuid, quota: finalQuota,
                ip_limit: finalIpLimit, expired: expiredDisplay,
                duration_minutes: parseInt(minutes),
                domain: systemInfo.domain,
                links: { tls: vlessTLS, http: vlessHTTP, grpc: vlessGRPC }
            }
        });
        
    } catch (error) {
        console.error('Error creating trial VLESS:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== CREATE VMESS ====================
app.post('/api/vmess/create', authMiddleware, async (req, res) => {
    try {
        const { username, uuid, quota, ip_limit, days } = req.body;
        
        if (!username || !days) {
            return res.status(400).json({ success: false, message: 'Username and days required' });
        }
        
        const systemInfo = await getSystemInfoForXray();
        const finalUuid = uuid || require('crypto').randomUUID();
        const finalQuota = quota || 0;
        const finalIpLimit = ip_limit || 0;
        
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + parseInt(days));
        const expired = expDate.toISOString().split('T')[0];
        const expiredDisplay = expDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        
        const vmessDbPath = '/etc/peyx/vmess.db';
        if (fs.existsSync(vmessDbPath)) {
            const dbContent = fs.readFileSync(vmessDbPath, 'utf8');
            if (dbContent.includes(`### ${username} `)) {
                return res.status(400).json({ success: false, message: 'Username already exists!' });
            }
        }
        
        const xrayConfig = '/usr/local/etc/xray/config.json';
        if (!fs.existsSync(xrayConfig)) {
            return res.status(400).json({ success: false, message: 'Xray config not found!' });
        }
        
        let config = JSON.parse(fs.readFileSync(xrayConfig, 'utf8'));
        let found = false;
        
        config.inbounds = config.inbounds.map(inbound => {
            if (inbound.protocol === 'vmess') {
                if (!inbound.settings.clients) inbound.settings.clients = [];
                inbound.settings.clients.push({ id: finalUuid, alterId: 0, email: username });
                found = true;
            }
            return inbound;
        });
        
        if (!found) {
            return res.status(400).json({ success: false, message: 'VMESS inbound not found!' });
        }
        
        fs.writeFileSync(xrayConfig, JSON.stringify(config, null, 2));
        
        if (finalIpLimit > 0) {
            const limitDir = '/etc/peyx/limit/vmess/ip';
            if (!fs.existsSync(limitDir)) fs.mkdirSync(limitDir, { recursive: true });
            fs.writeFileSync(`/etc/peyx/limit/vmess/ip/${username}`, finalIpLimit.toString());
        }
        
        if (finalQuota > 0) {
            const quotaDir = '/etc/peyx/vmess';
            if (!fs.existsSync(quotaDir)) fs.mkdirSync(quotaDir, { recursive: true });
            fs.writeFileSync(`/etc/peyx/vmess/${username}`, (finalQuota * 1024 * 1024 * 1024).toString());
        }
        
        let dbContent = '';
        if (fs.existsSync(vmessDbPath)) {
            dbContent = fs.readFileSync(vmessDbPath, 'utf8');
        }
        dbContent += `### ${username} ${expired} ${finalUuid} ${finalQuota} ${finalIpLimit}\n`;
        fs.writeFileSync(vmessDbPath, dbContent);
        
        exec('systemctl restart xray', () => {});
        
        const vmessTLS = `vmess://${Buffer.from(JSON.stringify({
            v: "2", ps: username, add: systemInfo.domain, port: "443",
            id: finalUuid, aid: "0", net: "ws", path: "/vmess",
            host: systemInfo.domain, tls: "tls"
        })).toString('base64')}`;
        
        const vmessHTTP = `vmess://${Buffer.from(JSON.stringify({
            v: "2", ps: username, add: systemInfo.domain, port: "80",
            id: finalUuid, aid: "0", net: "ws", path: "/vmess",
            host: systemInfo.domain, tls: "none"
        })).toString('base64')}`;
        
        const vmessGRPC = `vmess://${Buffer.from(JSON.stringify({
            v: "2", ps: username, add: systemInfo.domain, port: "443",
            id: finalUuid, aid: "0", net: "grpc", path: "vmess-grpc",
            host: systemInfo.domain, tls: "tls"
        })).toString('base64')}`;
        
        const notificationMessage = `
<b>🔔 VMESS ACCOUNT CREATED</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Username:</b> <code>${username}</code>
<b>UUID:</b> <code>${finalUuid}</code>
<b>Quota:</b> ${finalQuota} GB
<b>IP Limit:</b> ${finalIpLimit}
<b>Expired:</b> ${expiredDisplay}
<b>Domain:</b> <code>${systemInfo.domain}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>🔗 TLS (443):</b>
<code>${vmessTLS}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>🔗 HTTP (80):</b>
<code>${vmessHTTP}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>🔗 GRPC:</b>
<code>${vmessGRPC}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>Waktu:</b> ${timestamp}
<b>Status:</b> ✅ Berhasil dibuat
        `.trim();
        
        await sendTelegramNotification(notificationMessage);
        
        res.json({
            success: true,
            message: 'VMESS account created successfully',
            data: {
                username, uuid: finalUuid, quota: finalQuota,
                ip_limit: finalIpLimit, expired: expiredDisplay,
                domain: systemInfo.domain,
                links: { tls: vmessTLS, http: vmessHTTP, grpc: vmessGRPC }
            }
        });
        
    } catch (error) {
        console.error('Error creating VMESS:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== RENEW VMESS ====================
app.post('/api/vmess/renew', authMiddleware, async (req, res) => {
    try {
        const { username, days, quota, ip_limit } = req.body;
        
        if (!username || !days) {
            return res.status(400).json({ success: false, message: 'Username and days required' });
        }
        
        const vmessDbPath = '/etc/peyx/vmess.db';
        
        if (!fs.existsSync(vmessDbPath)) {
            return res.status(404).json({ success: false, message: 'VMESS database not found!' });
        }
        
        let dbContent = fs.readFileSync(vmessDbPath, 'utf8');
        const lines = dbContent.split('\n');
        let userLineIndex = -1;
        let userLine = '';
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith(`### ${username} `)) {
                userLineIndex = i;
                userLine = lines[i];
                break;
            }
        }
        
        if (userLineIndex === -1) {
            return res.status(404).json({ success: false, message: 'Username not found!' });
        }
        
        const parts = userLine.split(' ');
        const oldExpired = parts[2];
        const uuid = parts[3];
        const oldQuota = parts[4] || 0;
        const oldIpLimit = parts[5] || 0;
        
        const newQuota = quota !== undefined ? quota : parseInt(oldQuota);
        const newIpLimit = ip_limit !== undefined ? ip_limit : parseInt(oldIpLimit);
        
        const oldExpDate = new Date(oldExpired);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let newExpired;
        if (oldExpDate < today) {
            newExpired = new Date();
            newExpired.setDate(newExpired.getDate() + parseInt(days));
        } else {
            newExpired = new Date(oldExpired);
            newExpired.setDate(newExpired.getDate() + parseInt(days));
        }
        
        const newExpiredStr = newExpired.toISOString().split('T')[0];
        const oldExpiredDisplay = new Date(oldExpired).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const newExpiredDisplay = newExpired.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        
        if (newIpLimit > 0) {
            const limitDir = '/etc/peyx/limit/vmess/ip';
            if (!fs.existsSync(limitDir)) fs.mkdirSync(limitDir, { recursive: true });
            fs.writeFileSync(`/etc/peyx/limit/vmess/ip/${username}`, newIpLimit.toString());
        }
        
        if (newQuota > 0) {
            const quotaDir = '/etc/peyx/vmess';
            if (!fs.existsSync(quotaDir)) fs.mkdirSync(quotaDir, { recursive: true });
            fs.writeFileSync(`/etc/peyx/vmess/${username}`, (newQuota * 1024 * 1024 * 1024).toString());
        }
        
        lines[userLineIndex] = `### ${username} ${newExpiredStr} ${uuid} ${newQuota} ${newIpLimit}`;
        fs.writeFileSync(vmessDbPath, lines.join('\n'));
        
        exec('systemctl restart xray', () => {});
        
        const notificationMessage = `
<b>🔄 VMESS ACCOUNT RENEWED</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Username:</b> <code>${username}</code>
<b>Quota:</b> ${newQuota} GB
<b>IP Limit:</b> ${newIpLimit}
<b>Expired Sebelum:</b> ${oldExpiredDisplay}
<b>Expired Baru:</b> ${newExpiredDisplay}
<b>Durasi Tambahan:</b> ${days} hari
━━━━━━━━━━━━━━━━━━━━━
<b>Waktu:</b> ${timestamp}
<b>Status:</b> ✅ Berhasil diperpanjang
        `.trim();
        
        await sendTelegramNotification(notificationMessage);
        
        res.json({
            success: true,
            message: 'VMESS account renewed successfully',
            data: {
                username, old_expired: oldExpiredDisplay,
                new_expired: newExpiredDisplay, days_added: parseInt(days),
                quota: newQuota, ip_limit: newIpLimit
            }
        });
        
    } catch (error) {
        console.error('Error renewing VMESS:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== DELETE VMESS ====================
app.post('/api/vmess/delete', authMiddleware, async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({ success: false, message: 'Username required' });
        }
        
        const vmessDbPath = '/etc/peyx/vmess.db';
        
        if (!fs.existsSync(vmessDbPath)) {
            return res.status(404).json({ success: false, message: 'VMESS database not found!' });
        }
        
        let dbContent = fs.readFileSync(vmessDbPath, 'utf8');
        const lines = dbContent.split('\n');
        let userLineIndex = -1;
        let quota = 0, iplimit = 0, expired = '';
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith(`### ${username} `)) {
                userLineIndex = i;
                const parts = lines[i].split(' ');
                expired = parts[2];
                quota = parts[4] || 0;
                iplimit = parts[5] || 0;
                break;
            }
        }
        
        if (userLineIndex === -1) {
            return res.status(404).json({ success: false, message: 'Username not found!' });
        }
        
        const xrayConfig = '/usr/local/etc/xray/config.json';
        if (fs.existsSync(xrayConfig)) {
            let config = JSON.parse(fs.readFileSync(xrayConfig, 'utf8'));
            
            config.inbounds = config.inbounds.map(inbound => {
                if (inbound.protocol === 'vmess' && inbound.settings.clients) {
                    inbound.settings.clients = inbound.settings.clients.filter(client => client.email !== username);
                }
                return inbound;
            });
            
            fs.writeFileSync(xrayConfig, JSON.stringify(config, null, 2));
        }
        
        lines.splice(userLineIndex, 1);
        fs.writeFileSync(vmessDbPath, lines.join('\n'));
        
        const expiredDisplay = new Date(expired).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        
        const notificationMessage = `
<b>🗑️ VMESS ACCOUNT DELETED</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Username:</b> <code>${username}</code>
<b>Quota:</b> ${quota} GB
<b>IP Limit:</b> ${iplimit}
<b>Expired:</b> ${expiredDisplay}
━━━━━━━━━━━━━━━━━━━━━
<b>Waktu:</b> ${timestamp}
<b>Status:</b> ✅ Berhasil dihapus
        `.trim();
        
        await sendTelegramNotification(notificationMessage);
        
        try {
            fs.unlinkSync(`/etc/peyx/limit/vmess/ip/${username}`);
            fs.unlinkSync(`/etc/peyx/vmess/${username}`);
            fs.unlinkSync(`/var/www/html/vmess-${username}.txt`);
        } catch(e) {}
        
        exec('systemctl restart xray', () => {});
        
        res.json({
            success: true,
            message: 'VMESS account deleted successfully',
            data: { username, expired: expiredDisplay, quota, ip_limit: iplimit }
        });
        
    } catch (error) {
        console.error('Error deleting VMESS:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== TRIAL VMESS ====================
// ==================== TRIAL VMESS ====================
app.post('/api/vmess/trial', authMiddleware, async (req, res) => {
    try {
        const { username, password, minutes } = req.body;
        
        if (!username || !minutes) {
            return res.status(400).json({ success: false, message: 'Username and minutes required' });
        }
        
        if (minutes < 1 || minutes > 60) {
            return res.status(400).json({ success: false, message: 'Minutes must be between 1 and 60' });
        }
        
        const systemInfo = await getSystemInfoForXray();
        
        // UNIVERSAL: Gunakan password dari request sebagai UUID, jika tidak generate random
        let finalUuid;
        if (password && password.length >= 4) {
            finalUuid = password;
            console.log(`✅ Using custom UUID for VMess trial: ${username}`);
        } else {
            finalUuid = require('crypto').randomUUID();
            console.log(`✅ Using generated UUID for VMess trial: ${username}`);
        }
        
        const finalQuota = 1;
        const finalIpLimit = 1;
        
        const expDate = new Date();
        expDate.setMinutes(expDate.getMinutes() + parseInt(minutes));
        const expired = expDate.toISOString();
        const expiredDisplay = expDate.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        
        const vmessDbPath = '/etc/peyx/vmess_trial.db';
        if (fs.existsSync(vmessDbPath)) {
            const dbContent = fs.readFileSync(vmessDbPath, 'utf8');
            if (dbContent.includes(`### ${username} `)) {
                return res.status(400).json({ success: false, message: 'Username already exists!' });
            }
        }
        
        const xrayConfig = '/usr/local/etc/xray/config.json';
        if (!fs.existsSync(xrayConfig)) {
            return res.status(400).json({ success: false, message: 'Xray config not found!' });
        }
        
        let config = JSON.parse(fs.readFileSync(xrayConfig, 'utf8'));
        let found = false;
        
        config.inbounds = config.inbounds.map(inbound => {
            if (inbound.protocol === 'vmess') {
                if (!inbound.settings.clients) inbound.settings.clients = [];
                inbound.settings.clients.push({ id: finalUuid, alterId: 0, email: username });
                found = true;
            }
            return inbound;
        });
        
        if (!found) {
            return res.status(400).json({ success: false, message: 'VMESS inbound not found!' });
        }
        
        fs.writeFileSync(xrayConfig, JSON.stringify(config, null, 2));
        
        if (finalIpLimit > 0) {
            const limitDir = '/etc/peyx/limit/vmess/ip';
            if (!fs.existsSync(limitDir)) fs.mkdirSync(limitDir, { recursive: true });
            fs.writeFileSync(`/etc/peyx/limit/vmess/ip/${username}`, finalIpLimit.toString());
        }
        
        let dbContent = '';
        if (fs.existsSync(vmessDbPath)) {
            dbContent = fs.readFileSync(vmessDbPath, 'utf8');
        }
        dbContent += `### ${username} ${expired} ${finalUuid} ${finalQuota} ${finalIpLimit}\n`;
        fs.writeFileSync(vmessDbPath, dbContent);
        
        const deleteScript = `/usr/local/bin/delete_trial_vmess_${username}.sh`;
        const scriptContent = `#!/bin/bash
jq --arg user "${username}" '.inbounds |= map(if .protocol == "vmess" then .settings.clients |= map(select(.email != \$user)) else . end)' /usr/local/etc/xray/config.json > /usr/local/etc/xray/config.json.tmp && mv /usr/local/etc/xray/config.json.tmp /usr/local/etc/xray/config.json
rm -f /etc/peyx/limit/vmess/ip/${username}
rm -f /var/www/html/vmess-${username}.txt
sed -i "/### ${username} /d" /etc/peyx/vmess_trial.db
systemctl restart xray
rm -f ${deleteScript}`;
        
        fs.writeFileSync(deleteScript, scriptContent);
        fs.chmodSync(deleteScript, '755');
        
        exec(`echo "${deleteScript}" | at now + ${minutes} minutes`, () => {});
        exec('systemctl restart xray', () => {});
        
        const vmessTLS = `vmess://${Buffer.from(JSON.stringify({
            v: "2", ps: username, add: systemInfo.domain, port: "443",
            id: finalUuid, aid: "0", net: "ws", path: "/vmess",
            host: systemInfo.domain, tls: "tls"
        })).toString('base64')}`;
        
        const vmessHTTP = `vmess://${Buffer.from(JSON.stringify({
            v: "2", ps: username, add: systemInfo.domain, port: "80",
            id: finalUuid, aid: "0", net: "ws", path: "/vmess",
            host: systemInfo.domain, tls: "none"
        })).toString('base64')}`;
        
        const vmessGRPC = `vmess://${Buffer.from(JSON.stringify({
            v: "2", ps: username, add: systemInfo.domain, port: "443",
            id: finalUuid, aid: "0", net: "grpc", path: "vmess-grpc",
            host: systemInfo.domain, tls: "tls"
        })).toString('base64')}`;
        
        const notificationMessage = `
<b>⏰ TRIAL VMESS ACCOUNT</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Username:</b> <code>${username}</code>
<b>UUID:</b> <code>${finalUuid}</code>
<b>Quota:</b> ${finalQuota} GB
<b>IP Limit:</b> ${finalIpLimit}
<b>Expired:</b> ${expiredDisplay}
<b>Domain:</b> <code>${systemInfo.domain}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>🔗 TLS (443):</b>
<code>${vmessTLS}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>🔗 HTTP (80):</b>
<code>${vmessHTTP}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>🔗 GRPC:</b>
<code>${vmessGRPC}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>📅 Waktu:</b> ${timestamp}
<b>Catatan:</b> Trial berlaku ${minutes} menit
        `.trim();
        
        await sendTelegramNotification(notificationMessage);
        
        res.json({
            success: true,
            message: 'Trial VMESS account created successfully',
            data: {
                username, uuid: finalUuid, quota: finalQuota,
                ip_limit: finalIpLimit, expired: expiredDisplay,
                duration_minutes: parseInt(minutes),
                domain: systemInfo.domain,
                links: { tls: vmessTLS, http: vmessHTTP, grpc: vmessGRPC }
            }
        });
        
    } catch (error) {
        console.error('Error creating trial VMESS:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== SSH ACCOUNT FUNCTIONS ====================

// Fungsi untuk mendapatkan info sistem
async function getSSHSystemInfo() {
    return new Promise((resolve) => {
        const info = {};
        
        exec('curl -s ipinfo.io/org | cut -d " " -f 2-10', (err, stdout) => {
            info.isp = err ? 'Unknown ISP' : stdout.trim() || 'Unknown ISP';
            
            exec('curl -s ipinfo.io/city', (err2, stdout2) => {
                info.city = err2 ? 'Unknown City' : stdout2.trim() || 'Unknown City';
                
                if (fs.existsSync(DOMAIN_FILE)) {
                    info.domain = fs.readFileSync(DOMAIN_FILE, 'utf8').trim();
                } else {
                    info.domain = 'example.com';
                }
                
                exec('curl -sS ipv4.icanhazip.com', (err3, stdout3) => {
                    info.ip = err3 ? 'Unknown IP' : stdout3.trim();
                    resolve(info);
                });
            });
        });
    });
}

// ==================== CREATE SSH ACCOUNT ====================
app.post('/api/ssh/create', authMiddleware, async (req, res) => {
    try {
        const { username, password, ip_limit, days } = req.body;
        
        if (!username || !days) {
            return res.status(400).json({ success: false, message: 'Username and days required' });
        }
        
        const systemInfo = await getSSHSystemInfo();
        const finalPassword = password || Math.random().toString(36).substr(2, 10);
        const finalIpLimit = ip_limit || 0;
        
        // Cek apakah user sudah ada
        const userCheck = await new Promise((resolve) => {
            exec(`id ${username}`, (error) => {
                resolve(!error);
            });
        });
        
        if (userCheck) {
            return res.status(400).json({ success: false, message: 'Username already exists!' });
        }
        
        // Hitung expired date
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + parseInt(days));
        const expired = expDate.toISOString().split('T')[0];
        const expiredDisplay = expDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        
        // Buat user SSH
        await new Promise((resolve) => {
            exec(`useradd -e ${expired} -s /bin/false -M ${username}`, (error) => {
                resolve();
            });
        });
        
        // Set password
        await new Promise((resolve) => {
            exec(`echo "${username}:${finalPassword}" | chpasswd`, (error) => {
                resolve();
            });
        });
        
        // Set IP limit
        if (finalIpLimit > 0) {
            await new Promise((resolve) => {
                exec(`mkdir -p /etc/kyt/limit/ssh/ip && echo "${finalIpLimit}" > /etc/kyt/limit/ssh/ip/${username}`, (error) => {
                    resolve();
                });
            });
        }
        
        // Save to database
        const tgl = expDate.getDate();
        const bln = expDate.toLocaleDateString('id-ID', { month: 'short' });
        const thn = expDate.getFullYear();
        const expe = `${tgl} ${bln}, ${thn}`;
        
        await new Promise((resolve) => {
            exec(`mkdir -p /etc/ssh && echo "#ssh# ${username} ${finalPassword} 0 ${finalIpLimit} ${expe}" >> /etc/ssh/.ssh.db`, (error) => {
                resolve();
            });
        });
        
        // Payload templates
        const payloadWS = "GET / HTTP/1.1[crlf]Host: [host][crlf]Connection: Upgrade[crlf]User-Agent: [ua][crlf]Upgrade: websocket[crlf][crlf]";
        const payloadTLS = `GET wss://${systemInfo.domain}/ HTTP/1.1[crlf]Host: [host][crlf]Connection: Upgrade[crlf]User-Agent: [ua][crlf]Upgrade: websocket[crlf][crlf]`;
        
        // Format notifikasi seperti API ZiVPN
        const notificationMessage = `
<b>🔔 SSH ACCOUNT CREATED</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Username:</b> <code>${username}</code>
<b>Password:</b> <code>${finalPassword}</code>
<b>IP Limit:</b> ${finalIpLimit}
<b>Expired:</b> ${expiredDisplay}
<b>Domain:</b> <code>${systemInfo.domain}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>🔗 SSH WebSocket:</b>
<code>${systemInfo.domain}:80@${username}:${finalPassword}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>🔗 SSH SSL:</b>
<code>${systemInfo.domain}:443@${username}:${finalPassword}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>🔗 SSH UDP:</b>
<code>${systemInfo.domain}:1-65535@${username}:${finalPassword}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>📋 Payload WS:</b>
<code>${payloadWS}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>📋 Payload TLS:</b>
<code>${payloadTLS}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>📅 Waktu:</b> ${timestamp}
<b>Status:</b> ✅ Berhasil dibuat
        `.trim();
        
        // Kirim notifikasi Telegram
        await sendTelegramNotification(notificationMessage);
        
        res.json({
            success: true,
            message: 'SSH account created successfully',
            data: {
                username: username,
                password: finalPassword,
                ip_limit: finalIpLimit,
                expired: expiredDisplay,
                domain: systemInfo.domain,
                links: {
                    websocket: `${systemInfo.domain}:80@${username}:${finalPassword}`,
                    ssl: `${systemInfo.domain}:443@${username}:${finalPassword}`,
                    udp: `${systemInfo.domain}:1-65535@${username}:${finalPassword}`
                },
                payloads: {
                    ws: payloadWS,
                    tls: payloadTLS
                }
            }
        });
        
    } catch (error) {
        console.error('Error creating SSH account:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== TRIAL SSH ACCOUNT ====================
app.post('/api/ssh/trial', authMiddleware, async (req, res) => {
    try {
        const { username, minutes } = req.body;
        
        if (!username || !minutes) {
            return res.status(400).json({ success: false, message: 'Username and minutes required' });
        }
        
        const systemInfo = await getSSHSystemInfo();
        const finalPassword = 'pxstore';
        const finalIpLimit = 1;
        
        // Cek apakah user sudah ada
        const userCheck = await new Promise((resolve) => {
            exec(`id ${username}`, (error) => {
                resolve(!error);
            });
        });
        
        if (userCheck) {
            return res.status(400).json({ success: false, message: 'Username already exists!' });
        }
        
        // Hitung expired date
        const expDate = new Date();
        expDate.setMinutes(expDate.getMinutes() + parseInt(minutes));
        const expired = expDate.toISOString().split('T')[0];
        const expiredDisplay = expDate.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        
        // Buat user SSH
        await new Promise((resolve) => {
            exec(`useradd -e ${expired} -s /bin/false -M ${username}`, (error) => {
                resolve();
            });
        });
        
        // Set password
        await new Promise((resolve) => {
            exec(`echo "${username}:${finalPassword}" | chpasswd`, (error) => {
                resolve();
            });
        });
        
        // Set IP limit
        if (finalIpLimit > 0) {
            await new Promise((resolve) => {
                exec(`mkdir -p /etc/kyt/limit/ssh/ip && echo "${finalIpLimit}" > /etc/kyt/limit/ssh/ip/${username}`, (error) => {
                    resolve();
                });
            });
        }
        
        // Setup auto deletion
        await new Promise((resolve) => {
            exec(`echo "pkill -u ${username}; userdel -f ${username}; rm -f /etc/kyt/limit/ssh/ip/${username}" | at now + ${minutes} minutes`, (error) => {
                resolve();
            });
        });
        
        // Payload templates
        const payloadWS = "GET / HTTP/1.1[crlf]Host: [host][crlf]Connection: Upgrade[crlf]User-Agent: [ua][crlf]Upgrade: websocket[crlf][crlf]";
        const payloadTLS = `GET wss://${systemInfo.domain}/ HTTP/1.1[crlf]Host: [host][crlf]Connection: Upgrade[crlf]User-Agent: [ua][crlf]Upgrade: websocket[crlf][crlf]`;
        
        // Format notifikasi seperti API ZiVPN
        const notificationMessage = `
<b>⏰ TRIAL SSH ACCOUNT</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Username:</b> <code>${username}</code>
<b>Password:</b> <code>${finalPassword}</code>
<b>IP Limit:</b> ${finalIpLimit}
<b>Expired:</b> ${expiredDisplay}
<b>Domain:</b> <code>${systemInfo.domain}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>🔗 SSH WebSocket:</b>
<code>${systemInfo.domain}:80@${username}:${finalPassword}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>🔗 SSH SSL:</b>
<code>${systemInfo.domain}:443@${username}:${finalPassword}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>🔗 SSH UDP:</b>
<code>${systemInfo.domain}:1-65535@${username}:${finalPassword}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>📋 Payload WS:</b>
<code>${payloadWS}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>📋 Payload TLS:</b>
<code>${payloadTLS}</code>
━━━━━━━━━━━━━━━━━━━━━
<b>📅 Waktu:</b> ${timestamp}
<b>Catatan:</b> Trial berlaku ${minutes} menit
        `.trim();
        
        // Kirim notifikasi Telegram
        await sendTelegramNotification(notificationMessage);
        
        res.json({
            success: true,
            message: 'Trial SSH account created successfully',
            data: {
                username: username,
                password: finalPassword,
                ip_limit: finalIpLimit,
                expired: expiredDisplay,
                duration_minutes: parseInt(minutes),
                domain: systemInfo.domain,
                links: {
                    websocket: `${systemInfo.domain}:80@${username}:${finalPassword}`,
                    ssl: `${systemInfo.domain}:443@${username}:${finalPassword}`,
                    udp: `${systemInfo.domain}:1-65535@${username}:${finalPassword}`
                },
                payloads: {
                    ws: payloadWS,
                    tls: payloadTLS
                }
            }
        });
        
    } catch (error) {
        console.error('Error creating trial SSH account:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== RENEW SSH ACCOUNT ====================
app.post('/api/ssh/renew', authMiddleware, async (req, res) => {
    try {
        const { username, days } = req.body;
        
        if (!username || !days) {
            return res.status(400).json({ success: false, message: 'Username and days required' });
        }
        
        // Cek apakah user ada
        const userCheck = await new Promise((resolve) => {
            exec(`id ${username}`, (error) => {
                resolve(!error);
            });
        });
        
        if (!userCheck) {
            return res.status(404).json({ success: false, message: 'Username not found!' });
        }
        
        // Ambil expired date lama
        let oldExpired = '';
        let password = '';
        let iplimit = 0;
        
        await new Promise((resolve) => {
            exec(`chage -l ${username} | grep "Account expires" | awk -F": " '{print $2}'`, (error, stdout) => {
                oldExpired = stdout.trim();
                resolve();
            });
        });
        
        // Ambil password dan IP limit dari database
        await new Promise((resolve) => {
            exec(`grep "^#ssh# ${username} " /etc/ssh/.ssh.db | head -1 | awk '{print $3}'`, (error, stdout) => {
                password = stdout.trim();
                resolve();
            });
        });
        
        await new Promise((resolve) => {
            exec(`cat /etc/kyt/limit/ssh/ip/${username} 2>/dev/null || echo "0"`, (error, stdout) => {
                iplimit = parseInt(stdout.trim()) || 0;
                resolve();
            });
        });
        
        // Hitung expired baru
        let newExpired;
        const oldExpDate = new Date(oldExpired);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (oldExpDate < today || oldExpired === 'never') {
            newExpired = new Date();
            newExpired.setDate(newExpired.getDate() + parseInt(days));
        } else {
            newExpired = new Date(oldExpired);
            newExpired.setDate(newExpired.getDate() + parseInt(days));
        }
        
        const newExpiredStr = newExpired.toISOString().split('T')[0];
        const newExpiredDisplay = newExpired.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const oldExpiredDisplay = oldExpired === 'never' ? 'never' : new Date(oldExpired).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        
        // Update expired date
        await new Promise((resolve) => {
            exec(`usermod -e ${newExpiredStr} ${username}`, (error) => {
                resolve();
            });
        });
        
        // Unlock user if locked
        await new Promise((resolve) => {
            exec(`passwd -u ${username} 2>/dev/null`, (error) => {
                resolve();
            });
        });
        
        // Update database
        const tgl = newExpired.getDate();
        const bln = newExpired.toLocaleDateString('id-ID', { month: 'short' });
        const thn = newExpired.getFullYear();
        const expe = `${tgl} ${bln}, ${thn}`;
        
        await new Promise((resolve) => {
            exec(`sed -i "/^#ssh# ${username} /d" /etc/ssh/.ssh.db && echo "#ssh# ${username} ${password} 0 ${iplimit} ${expe}" >> /etc/ssh/.ssh.db`, (error) => {
                resolve();
            });
        });
        
        // Format notifikasi seperti API ZiVPN
        const notificationMessage = `
<b>🔄 SSH ACCOUNT RENEWED</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Username:</b> <code>${username}</code>
<b>IP Limit:</b> ${iplimit}
<b>Expired Sebelum:</b> ${oldExpiredDisplay}
<b>Expired Baru:</b> ${newExpiredDisplay}
<b>Durasi Tambahan:</b> ${days} hari
━━━━━━━━━━━━━━━━━━━━━
<b>📅 Waktu:</b> ${timestamp}
<b>Status:</b> ✅ Berhasil diperpanjang
        `.trim();
        
        // Kirim notifikasi Telegram
        await sendTelegramNotification(notificationMessage);
        
        res.json({
            success: true,
            message: 'SSH account renewed successfully',
            data: {
                username: username,
                old_expired: oldExpiredDisplay,
                new_expired: newExpiredDisplay,
                days_added: parseInt(days),
                ip_limit: iplimit
            }
        });
        
    } catch (error) {
        console.error('Error renewing SSH account:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== DELETE SSH ACCOUNT ====================
app.post('/api/ssh/delete', authMiddleware, async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({ success: false, message: 'Username required' });
        }
        
        // Cek apakah user ada
        const userCheck = await new Promise((resolve) => {
            exec(`id ${username}`, (error) => {
                resolve(!error);
            });
        });
        
        if (!userCheck) {
            return res.status(404).json({ success: false, message: 'Username not found!' });
        }
        
        // Ambil info user sebelum delete
        let expired = '';
        let password = '';
        let iplimit = 0;
        
        await new Promise((resolve) => {
            exec(`chage -l ${username} | grep "Account expires" | awk -F": " '{print $2}'`, (error, stdout) => {
                expired = stdout.trim();
                resolve();
            });
        });
        
        await new Promise((resolve) => {
            exec(`grep "^#ssh# ${username} " /etc/ssh/.ssh.db | head -1 | awk '{print $3}'`, (error, stdout) => {
                password = stdout.trim();
                resolve();
            });
        });
        
        await new Promise((resolve) => {
            exec(`cat /etc/kyt/limit/ssh/ip/${username} 2>/dev/null || echo "0"`, (error, stdout) => {
                iplimit = parseInt(stdout.trim()) || 0;
                resolve();
            });
        });
        
        const expiredDisplay = expired === 'never' ? 'never' : new Date(expired).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        
        // Hapus user
        await new Promise((resolve) => {
            exec(`userdel -f ${username}`, (error) => {
                resolve();
            });
        });
        
        // Hapus dari database
        await new Promise((resolve) => {
            exec(`sed -i "/^#ssh# ${username} /d" /etc/ssh/.ssh.db`, (error) => {
                resolve();
            });
        });
        
        // Hapus file limit
        await new Promise((resolve) => {
            exec(`rm -f /etc/kyt/limit/ssh/ip/${username}`, (error) => {
                resolve();
            });
        });
        
        // Format notifikasi seperti API ZiVPN
        const notificationMessage = `
<b>🗑️ SSH ACCOUNT DELETED</b>
━━━━━━━━━━━━━━━━━━━━━
<b>Username:</b> <code>${username}</code>
<b>IP Limit:</b> ${iplimit}
<b>Expired:</b> ${expiredDisplay}
━━━━━━━━━━━━━━━━━━━━━
<b>📅 Waktu:</b> ${timestamp}
<b>Status:</b> ✅ Berhasil dihapus
        `.trim();
        
        // Kirim notifikasi Telegram
        await sendTelegramNotification(notificationMessage);
        
        res.json({
            success: true,
            message: 'SSH account deleted successfully',
            data: {
                username: username,
                expired: expiredDisplay,
                ip_limit: iplimit
            }
        });
        
    } catch (error) {
        console.error('Error deleting SSH account:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== LIST SSH ACCOUNTS ====================
app.get('/api/ssh/list', authMiddleware, async (req, res) => {
    try {
        const users = [];
        
        await new Promise((resolve) => {
            exec(`awk -F: '$3 >= 1000 && $1 != "nobody" {print $1}' /etc/passwd`, (error, stdout) => {
                const usernames = stdout.trim().split('\n').filter(u => u);
                
                for (const username of usernames) {
                    exec(`chage -l ${username} | grep "Account expires" | awk -F": " '{print $2}'`, (err, expired) => {
                        exec(`passwd -S ${username} | awk '{print $2}'`, (err2, status) => {
                            users.push({
                                username: username,
                                expired: expired.trim(),
                                status: status.trim() === 'L' ? 'locked' : 'active'
                            });
                        });
                    });
                }
                
                setTimeout(() => resolve(), 2000);
            });
        });
        
        res.json({
            success: true,
            data: users,
            total: users.length
        });
        
    } catch (error) {
        console.error('Error listing SSH accounts:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== SERVICE STATUS WITH NOTIFICATION ====================
app.post('/api/services/status', authMiddleware, async (req, res) => {
    try {
        console.log('🔍 Service status endpoint called');
        
        // Helper function untuk cek status dengan promise
        function execPromise(command) {
            return new Promise((resolve) => {
                exec(command, (error) => {
                    resolve(!error);
                });
            });
        }
        
        // Cek semua service
        console.log('Checking services...');
        const xrayRunning = await execPromise('systemctl is-active --quiet xray');
        const nginxRunning = await execPromise('systemctl is-active --quiet nginx');
        const zivpnRunning = await execPromise('systemctl is-active --quiet zivpn');
        const apiRunning = await execPromise('systemctl is-active --quiet zivpn-api-js');
        const botRunning = await execPromise('systemctl is-active --quiet zivpn-bot');
        
        console.log(`Xray: ${xrayRunning}, Nginx: ${nginxRunning}, ZiVPN: ${zivpnRunning}, API: ${apiRunning}, Bot: ${botRunning}`);
        
        // Format pesan (pakai format sederhana dulu untuk test)
        const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        
        const message = `
<b>━━━━━━━━━━━━━━━━━━━━━</b>
<b>         SERVICE STATUS</b>
<b>━━━━━━━━━━━━━━━━━━━━━</b>

<b>Xray :</b> ${xrayRunning ? '✅ Running' : '❌ Stopped'}
<b>Nginx :</b> ${nginxRunning ? '✅ Running' : '❌ Stopped'}
<b>ZiVPN :</b> ${zivpnRunning ? '✅ Running' : '❌ Stopped'}
<b>API :</b> ${apiRunning ? '✅ Running' : '❌ Stopped'}
<b>Bot :</b> ${botRunning ? '✅ Running' : '❌ Stopped'}

<b>━━━━━━━━━━━━━━━━━━━━━</b>
<b>📅 Waktu:</b> ${timestamp}
<b>━━━━━━━━━━━━━━━━━━━━━</b>
        `.trim();
        
        console.log('Message to send:', message);
        console.log('Telegram config:', {
            enabled: TELEGRAM_ENABLED,
            has_token: !!TELEGRAM_BOT_TOKEN,
            has_chat_id: !!TELEGRAM_CHAT_ID,
            token_preview: TELEGRAM_BOT_TOKEN ? TELEGRAM_BOT_TOKEN.substring(0, 10) + '...' : null,
            chat_id: TELEGRAM_CHAT_ID
        });
        
        // Kirim notifikasi Telegram
        const sent = await sendTelegramNotification(message);
        console.log('Notification sent result:', sent);
        
        // Return response
        res.json({
            success: sent,
            message: sent ? 'Service status notification sent' : 'Failed to send notification',
            data: {
                services: [
                    { name: 'Xray', running: xrayRunning },
                    { name: 'Nginx', running: nginxRunning },
                    { name: 'ZiVPN', running: zivpnRunning },
                    { name: 'API', running: apiRunning },
                    { name: 'Bot', running: botRunning }
                ]
            },
            telegram_status: {
                enabled: TELEGRAM_ENABLED,
                has_token: !!TELEGRAM_BOT_TOKEN,
                has_chat_id: !!TELEGRAM_CHAT_ID
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error checking service status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check service status',
            error: error.message
        });
    }
});

// ==================== START SERVER ====================
// Load semua konfigurasi sebelum start
async function startServer() {
    // Load API Key
    loadApiKey();
    
    // Load konfigurasi Telegram
    await loadTelegramConfig();
    
    // Start server
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n✅ ZiVPN API running on port ${PORT}`);
        console.log(`🔑 API Key: ${AUTH_TOKEN}`);
        console.log(`📍 URL: http://0.0.0.0:${PORT}`);
        if (TELEGRAM_ENABLED && TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
            console.log(`🤖 Telegram notifications: ENABLED`);
            console.log(`📱 Chat ID: ${TELEGRAM_CHAT_ID}`);
        } else {
            console.log(`⚠️ Telegram notifications: DISABLED`);
        }
        console.log(`\n📋 Available endpoints:`);
        console.log(`   GET  /api/health`);
        console.log(`   GET  /api/users`);
        console.log(`   GET  /api/users/expiring-soon`);
        console.log(`   POST /api/user/create`);
        console.log(`   POST /api/user/create-random`);
        console.log(`   POST /api/user/trial`);
        console.log(`   POST /api/user/renew`);
        console.log(`   POST /api/user/renew-all-expired`);
        console.log(`   POST /api/user/delete`);
        console.log(`   POST /api/telegram/test`);
        console.log(`   POST  /api/services/status`);
        console.log(`   POST /api/trojan/create`);
        console.log(`   POST /api/trojan/renew`);
        console.log(`   POST /api/trojan/delete`);
        console.log(`   POST /api/trojan/trial`);
        console.log(`   POST /api/vless/create`);
        console.log(`   POST /api/vless/renew`);
        console.log(`   POST /api/vless/delete`);
        console.log(`   POST /api/vless/trial`);
        console.log(`   POST /api/vmess/create`);
        console.log(`   POST /api/vmess/renew`);
        console.log(`   POST /api/vmess/delete`);
        console.log(`   POST /api/vmess/trial`);
        console.log(`\n`);
    });
    
    // Jalankan pengecekan reminder pertama kali
    setTimeout(() => {
        checkAndSendExpiredReminders();
    }, 5000);
}

// Jalankan server
startServer().catch(console.error);

module.exports = app;