const mysql = require('mysql2');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || 'bpo_tracker'
};

const db = mysql.createConnection(dbConfig);

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err.message);
        process.exit(1);
    }

    console.log("Connected to DB.");

    // 1. Give Admin M5 permissions
    db.query(`SELECT permisos FROM roles WHERE id = 1`, (err, res) => {
        if (err) throw err;
        if (res.length > 0) {
            let perms = [];
            try { perms = typeof res[0].permisos === 'string' ? JSON.parse(res[0].permisos) : res[0].permisos; } catch (e) { }

            if (!perms.includes('m5_view')) perms.push('m5_view');
            if (!perms.includes('m5_edit')) perms.push('m5_edit');

            db.query(`UPDATE roles SET permisos = ? WHERE id = 1`, [JSON.stringify(perms)], (err2) => {
                if (err2) throw err2;
                console.log("Admin (ID 1) updated with M5 permissions.");

                // 2. Insert Coordinador Role
                const coordPerms = JSON.stringify(['m2_view', 'm2_edit', 'm3_view', 'm4_view', 'm4_edit', 'm5_view', 'm5_edit']);

                // Check if it exists and delete first to be idempotent, or just ignore if it exists
                db.query(`SELECT id FROM roles WHERE nombre_rol = 'Coordinador'`, (err3, res3) => {
                    if (err3) throw err3;
                    if (res3.length > 0) {
                        db.query(`UPDATE roles SET permisos = ? WHERE id = ?`, [coordPerms, res3[0].id], (err4) => {
                            if (err4) throw err4;
                            console.log("Coordinador role updated.");
                            db.end();
                        });
                    } else {
                        db.query(`INSERT INTO roles (nombre_rol, permisos) VALUES (?, ?)`, ['Coordinador', coordPerms], (err5) => {
                            if (err5) throw err5;
                            console.log("Coordinador role created.");
                            db.end();
                        });
                    }
                });
            });
        } else {
            console.log("Admin role not found.");
            db.end();
        }
    });
});
