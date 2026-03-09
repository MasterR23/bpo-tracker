require('dotenv').config();
const fs = require('fs');
const mysql = require('mysql2/promise');

async function importData() {
    console.log("Iniciando importación mágica cruzada hacia Aiven...");
    const db = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        ssl: { rejectUnauthorized: false }
    });

    console.log("✅ Conectado a la nube (" + process.env.DB_NAME + ")");

    try {
        // 1. Clean auto-generated fallback data to avoid primary key collisions
        await db.query('SET FOREIGN_KEY_CHECKS = 0');
        await db.query('TRUNCATE TABLE wave_daily_checklists');
        await db.query('TRUNCATE TABLE candidates');
        await db.query('TRUNCATE TABLE requisitions');
        await db.query('TRUNCATE TABLE users');
        await db.query('TRUNCATE TABLE waves');
        await db.query('TRUNCATE TABLE roles');
        console.log("🧹 Tablas limpiadas preparadas para recibir historial.");

        // 2. Read the original local dump (no Aiven formatting required)
        const sqlDump = fs.readFileSync('C:\\Users\\Felip\\Downloads\\bpo_tracker.sql', 'utf8');

        // 3. Extract and execute ONLY "INSERT INTO" lines
        const insertStatements = sqlDump.match(/INSERT INTO[^;]+;/g) || [];
        console.log(`📦 Encontradas ${insertStatements.length} sentencias de recarga de datos.`);

        let count = 0;
        for (let statement of insertStatements) {
            await db.query(statement);
            count++;
        }

        await db.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log(`🎉 ¡Importación perfecta! Se inyectaron ${count} bloques de datos con éxito.`);
    } catch (err) {
        console.error("❌ Error importando datos:", err.message);
    } finally {
        await db.end();
        process.exit();
    }
}

importData();
