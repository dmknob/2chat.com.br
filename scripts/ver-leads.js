require('dotenv').config();
const db = require('../database/db');
const leads = db.prepare('SELECT * FROM leads ORDER BY created_at DESC LIMIT 5').all();
console.table(leads.map(l => ({
    Data: l.created_at,
    Tenant: l.tenant_id, // Pode fazer join se quiser o nome
    IP: l.ip_hash.substring(0, 8),
    Local: `${l.city}, ${l.country}`
})));
