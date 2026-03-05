const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 1. Initial Connection to create DB if it doesn't exist
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root', // Default XAMPP user
    password: process.env.DB_PASSWORD || '', // Default XAMPP password
    port: process.env.DB_PORT || 3306 // Render usually needs the port specified
};

const dbInitial = mysql.createConnection(dbConfig);

dbInitial.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err.message);
        console.log('Si estás en local, asegúrate de que MySQL está corriendo en XAMPP. Si estás en Render, verifica tus variables de entorno.');
        return;
    }

    dbInitial.query("CREATE DATABASE IF NOT EXISTS bpo_tracker", (err) => {
        if (err) throw err;
        console.log("Database bpo_tracker ready.");

        dbInitial.end();
        initializeDatabaseConnection();
    });
});

let db;

function initializeDatabaseConnection() {
    // 2. Connect to the specific database
    db = mysql.createConnection({
        ...dbConfig,
        database: process.env.DB_NAME || 'bpo_tracker'
    });

    db.connect((err) => {
        if (err) {
            console.error('Error connecting to bpo_tracker database:', err.message);
            return;
        }
        console.log("Connected to bpo_tracker database.");
        createTables();
    });
}

function createTables() {
    const createReqTable = `
        CREATE TABLE IF NOT EXISTS requisitions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            campana VARCHAR(255) NOT NULL,
            perfil_cargo VARCHAR(255) NOT NULL,
            salario DECIMAL(10, 2) NOT NULL,
            cupos INT NOT NULL,
            fecha_ingreso DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    const createCandTable = `
        CREATE TABLE IF NOT EXISTS candidates (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nombre_completo VARCHAR(255) NOT NULL,
            documento_id VARCHAR(100) NOT NULL,
            correo_electronico VARCHAR(255) NOT NULL,
            requisicion_id INT NOT NULL,
            wave_id INT DEFAULT NULL,
            estado VARCHAR(50) DEFAULT 'selected',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (requisicion_id) REFERENCES requisitions(id) ON DELETE RESTRICT,
            FOREIGN KEY (wave_id) REFERENCES waves(id) ON DELETE SET NULL
        )
    `;

    const createWavesTable = `
        CREATE TABLE IF NOT EXISTS waves (
            id INT AUTO_INCREMENT PRIMARY KEY,
            campana VARCHAR(255) NOT NULL,
            codigo_wave VARCHAR(100) NOT NULL UNIQUE,
            formador_responsable VARCHAR(255) NOT NULL,
            correo_responsable VARCHAR(255) NOT NULL,
            correo_area_encargada VARCHAR(255) NOT NULL,
            horas_planeadas_dia INT NOT NULL,
            umbral_dia_completo INT NOT NULL,
            salario_mensual_referencia DECIMAL(10,2) NOT NULL,
            tarifa_hora DECIMAL(10,2),
            cantidad_agentes INT NOT NULL,
            fecha_inicio DATE NOT NULL,
            fecha_fin DATE NOT NULL,
            dias_laborales JSON NOT NULL,
            incluir_festivos BOOLEAN DEFAULT false,
            requisiciones_asociadas JSON,
            recargos JSON,
            costo_total_proyectado DECIMAL(15,2) DEFAULT 0,
            generar_checklist BOOLEAN DEFAULT true,
            estado VARCHAR(50) DEFAULT 'en curso',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    const createRolesTable = `
        CREATE TABLE IF NOT EXISTS roles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nombre_rol VARCHAR(100) NOT NULL UNIQUE,
            permisos JSON NOT NULL
        )
    `;

    const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nombre VARCHAR(255) NOT NULL,
            apellido VARCHAR(255) NOT NULL,
            cedula VARCHAR(100) NOT NULL UNIQUE,
            correo VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            rol_id INT NOT NULL,
            must_change_password BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE RESTRICT
        )
    `;

    const createChecklistsTable = `
        CREATE TABLE IF NOT EXISTS wave_daily_checklists (
            id INT AUTO_INCREMENT PRIMARY KEY,
            wave_id INT NOT NULL,
            fecha DATE NOT NULL,
            trabajo BOOLEAN DEFAULT TRUE,
            horas_plan INT DEFAULT 0,
            horas_trabajadas INT DEFAULT 0,
            ausencias INT DEFAULT 0,
            quiz_realizado BOOLEAN DEFAULT FALSE,
            score DECIMAL(5,2) DEFAULT 0,
            notas TEXT,
            total_dia DECIMAL(12,2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (wave_id) REFERENCES waves(id) ON DELETE CASCADE
        )
    `;

    db.query(createRolesTable, (err) => {
        if (err) throw err;
        db.query(createUsersTable, (err) => {
            if (err) throw err;
            db.query(createReqTable, (err) => {
                if (err) throw err;
                db.query(createWavesTable, (err) => {
                    if (err) throw err;
                    db.query(createCandTable, (err) => {
                        if (err) throw err;
                        db.query(createChecklistsTable, async (err) => {
                            if (err) throw err;

                            // Check if Admin role exists, if not, create default Roles and Admin User
                            db.query("SELECT * FROM roles WHERE nombre_rol = 'Admin'", async (err, results) => {
                                if (results.length === 0) {
                                    // Default Roles
                                    const adminPerms = JSON.stringify(["m1_view", "m1_edit", "m1_delete", "m2_view", "m2_edit", "m3_view", "m3_edit", "m4_view", "admin_panel"]);
                                    const valAdm = ["Admin", adminPerms];

                                    const analistaPerms = JSON.stringify(["m1_view", "m1_edit", "m2_view", "m2_edit", "m3_view"]);
                                    const valAna = ["Analista", analistaPerms];

                                    const formadorPerms = JSON.stringify(["m2_view", "m3_view", "m4_view"]);
                                    const valFor = ["Formador", formadorPerms];

                                    db.query("INSERT INTO roles (nombre_rol, permisos) VALUES (?,?), (?,?), (?,?)",
                                        [...valAdm, ...valAna, ...valFor], async (err, rRes) => {
                                            if (err) console.error("Error creating default roles:", err);
                                            else {
                                                // Admin role is insertId
                                                const adminHash = await bcrypt.hash("admin123", 10);
                                                db.query("INSERT INTO users (nombre, apellido, cedula, correo, password_hash, rol_id, must_change_password) VALUES (?,?,?,?,?,?,?)",
                                                    ["Super", "Administrador", "admin", "admin@bpo.com", adminHash, rRes.insertId, false]
                                                );
                                                console.log("Default Admin user created. (User: admin / Pass: admin123)");
                                            }
                                        });
                                }
                            });

                            // Auto-migration: ensure column exists for older dbs
                            db.query("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT TRUE", (err) => {
                                // Ignore error if column already exists
                            });

                            // Auto-migration M5
                            db.query("ALTER TABLE candidates ADD COLUMN estado_final VARCHAR(50) DEFAULT 'En curso (Activo)'", () => { });
                            db.query("ALTER TABLE candidates ADD COLUMN score_promedio DECIMAL(5,2) DEFAULT 0", () => { });

                            console.log("Tables synchronized. All tables ready.");
                        });
                    });
                });
            });
        });
    });
}

// ============================================
// API ROUTES: REQUISITIONS
// ============================================

// Get all requisitions with their "ocupados" count
app.get('/api/requisitions', (req, res) => {
    const query = `
        SELECT r.*, 
               (SELECT COUNT(*) FROM candidates c WHERE c.requisicion_id = r.id) as ocupados
        FROM requisitions r
        ORDER BY r.created_at DESC
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Create new requisition
app.post('/api/requisitions', (req, res) => {
    const { campana, perfil_cargo, salario, cupos, fecha_ingreso } = req.body;

    const query = `INSERT INTO requisitions (campana, perfil_cargo, salario, cupos, fecha_ingreso) VALUES (?, ?, ?, ?, ?)`;
    db.query(query, [campana, perfil_cargo, salario, cupos, fecha_ingreso], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: result.insertId });
    });
});

// Delete a requisition (Soft-ish/Hard) -> Only allows if no candidates attached (ON DELETE RESTRICT is set)
app.delete('/api/requisitions/:id', (req, res) => {
    const reqId = req.params.id;
    const query = `DELETE FROM requisitions WHERE id = ?`;

    db.query(query, [reqId], (err, result) => {
        if (err) {
            // Check if it's a foreign key constraint error
            if (err.code === 'ER_ROW_IS_REFERENCED_2') {
                return res.status(400).json({ error: "No se puede eliminar la requisición porque tiene candidatos asociados. Debes eliminar o reasignar los candidatos primero." });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

// ============================================
// API ROUTES: CANDIDATES
// ============================================

// Get all candidates with their associated requisition
app.get('/api/candidates', (req, res) => {
    const query = `
        SELECT c.*, r.campana, r.perfil_cargo 
        FROM candidates c
        LEFT JOIN requisitions r ON c.requisicion_id = r.id
        ORDER BY c.created_at DESC
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Get available candidates (no wave assigned)
app.get('/api/candidates/available', (req, res) => {
    const query = `
        SELECT c.*, r.campana, r.perfil_cargo 
        FROM candidates c
        LEFT JOIN requisitions r ON c.requisicion_id = r.id
        WHERE c.wave_id IS NULL AND c.estado = 'selected'
        ORDER BY c.created_at DESC
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Get candidates assigned to a specific wave
app.get('/api/waves/:id/candidates', (req, res) => {
    const query = `
        SELECT c.*, r.campana, r.perfil_cargo 
        FROM candidates c
        LEFT JOIN requisitions r ON c.requisicion_id = r.id
        WHERE c.wave_id = ?
        ORDER BY c.created_at DESC
    `;

    db.query(query, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Assign a candidate to a wave
app.put('/api/candidates/:id/assign', (req, res) => {
    const { wave_id } = req.body;
    db.query('SELECT estado FROM waves WHERE id = ?', [wave_id], (errW, resultsW) => {
        if (errW) return res.status(500).json({ error: errW.message });
        if (resultsW.length > 0 && resultsW[0].estado === 'finalizada') {
            return res.status(403).json({ error: 'Wave cerrada: No se permiten asignaciones.' });
        }
        const query = `UPDATE candidates SET wave_id = ?, estado = 'in_training' WHERE id = ?`;
        db.query(query, [wave_id, req.params.id], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
});

// Unassign a candidate from a wave
app.put('/api/candidates/:id/unassign', (req, res) => {
    db.query('SELECT w.estado FROM waves w JOIN candidates c ON w.id = c.wave_id WHERE c.id = ?', [req.params.id], (errW, resultsW) => {
        if (errW) return res.status(500).json({ error: errW.message });
        if (resultsW.length > 0 && resultsW[0].estado === 'finalizada') {
            return res.status(403).json({ error: 'Wave cerrada: No se permiten desasignaciones.' });
        }
        const query = `UPDATE candidates SET wave_id = NULL, estado = 'selected' WHERE id = ?`;
        db.query(query, [req.params.id], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
});

// Create new candidate
app.post('/api/candidates', (req, res) => {
    const { nombre_completo, documento_id, correo_electronico, requisicion_id } = req.body;

    // Check if requisition has spots available before inserting
    const checkQuery = `
        SELECT cupos, (SELECT COUNT(*) FROM candidates c WHERE c.requisicion_id = r.id) as ocupados
        FROM requisitions r WHERE r.id = ?
    `;

    db.query(checkQuery, [requisicion_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: "Requisición no encontrada" });

        const { cupos, ocupados } = results[0];

        if (ocupados >= cupos) {
            return res.status(400).json({ error: "Esta requisición ya ha llenado todos sus cupos disponibles." });
        }

        const insertQuery = `INSERT INTO candidates (nombre_completo, documento_id, correo_electronico, requisicion_id) VALUES (?, ?, ?, ?)`;
        db.query(insertQuery, [nombre_completo, documento_id, correo_electronico, requisicion_id], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: result.insertId });
        });
    });
});

// Delete a candidate
app.delete('/api/candidates/:id', (req, res) => {
    const query = `DELETE FROM candidates WHERE id = ?`;
    db.query(query, [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ============================================
// API ROUTES: WAVES
// ============================================

app.get('/api/waves', (req, res) => {
    const query = `SELECT * FROM waves ORDER BY created_at DESC`;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Get a single wave by ID
app.get('/api/waves/:id', (req, res) => {
    const query = `SELECT * FROM waves WHERE id = ?`;
    db.query(query, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: "Wave no encontrada" });
        res.json(results[0]);
    });
});

app.post('/api/waves', (req, res) => {
    const data = req.body;

    const query = `
        INSERT INTO waves (
            campana, codigo_wave, formador_responsable, correo_responsable, correo_area_encargada,
            horas_planeadas_dia, umbral_dia_completo, salario_mensual_referencia, tarifa_hora,
            cantidad_agentes, fecha_inicio, fecha_fin, dias_laborales, incluir_festivos,
            requisiciones_asociadas, recargos, generar_checklist, costo_total_proyectado, estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        data.campana, data.codigo_wave, data.formador_responsable, data.correo_responsable, data.correo_area_encargada,
        data.horas_planeadas_dia, data.umbral_dia_completo, data.salario_mensual_referencia, data.tarifa_hora,
        data.cantidad_agentes, data.fecha_inicio, data.fecha_fin, JSON.stringify(data.dias_laborales), data.incluir_festivos,
        JSON.stringify(data.requisiciones_asociadas), JSON.stringify(data.recargos), data.generar_checklist, data.costo_total_proyectado || 0, data.estado || 'en curso'
    ];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error("SQL Error on Wave Insert:", err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, id: result.insertId });
    });
});

// GET checklist for a wave
app.get('/api/waves/:id/checklist', (req, res) => {
    const query = `SELECT * FROM wave_daily_checklists WHERE wave_id = ? ORDER BY fecha ASC`;
    db.query(query, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// UPDATE checklist multiple rows
app.put('/api/waves/:id/checklist', (req, res) => {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) return res.status(400).json({ error: "Datos inválidos" });

    db.query('SELECT estado FROM waves WHERE id = ?', [req.params.id], (errW, resultsW) => {
        if (errW) return res.status(500).json({ error: errW.message });
        if (resultsW.length > 0 && resultsW[0].estado === 'finalizada') {
            return res.status(403).json({ error: 'Wave cerrada: No se permite alterar el checklist.' });
        }

        let queriesCompleted = 0;
        let hasError = false;

        // Fast loop for inserts/updates (Consider a bulk query or transactions for production scale)
        items.forEach(item => {
            if (item.id) {
                // Update existing
                const query = `UPDATE wave_daily_checklists SET trabajo=?, horas_trabajadas=?, ausencias=?, quiz_realizado=?, score=?, notas=?, total_dia=? WHERE id=?`;
                db.query(query, [item.trabajo, item.horas_trabajadas, item.ausencias, item.quiz_realizado, item.score, item.notas, item.total_dia, item.id], (err) => {
                    if (err) hasError = true;
                    queriesCompleted++;
                    checkDone();
                });
            } else {
                // Insert new based on frontend generation (First time checklist load for a wave)
                const query = `INSERT INTO wave_daily_checklists (wave_id, fecha, trabajo, horas_plan, horas_trabajadas, ausencias, quiz_realizado, score, notas, total_dia) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                db.query(query, [req.params.id, item.fecha, item.trabajo, item.horas_plan, item.horas_trabajadas, item.ausencias, item.quiz_realizado, item.score, item.notas, item.total_dia], (err) => {
                    if (err) { console.error("Error inserting checklist row:", err); hasError = true; }
                    queriesCompleted++;
                    checkDone();
                });
            }
        });

        if (items.length === 0) return res.json({ success: true });

        function checkDone() {
            if (queriesCompleted === items.length) {
                if (hasError) return res.status(500).json({ error: "Hubo errores procesando algunos registros." });
                res.json({ success: true });
            }
        }
    });
});

// ============================================
// API ROUTES: AUTHENTICATION & SECURITY
// ============================================

app.post('/api/login', (req, res) => {
    const { cedula, password } = req.body;

    if (!cedula || !password) {
        return res.status(400).json({ error: "Datos incompletos" });
    }

    const query = `
        SELECT u.*, r.nombre_rol, r.permisos 
        FROM users u 
        JOIN roles r ON u.rol_id = r.id 
        WHERE u.cedula = ?
    `;

    db.query(query, [cedula], async (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(401).json({ error: "Credenciales inválidas" });

        const user = results[0];

        // Verify Password
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: "Credenciales inválidas" });

        // Clean password hash before sending
        delete user.password_hash;

        // Parse permissions array for convenience
        try {
            user.permisos = JSON.parse(user.permisos);
        } catch (e) { user.permisos = []; }

        res.json({ success: true, user });
    });
});

// --- USERS CRUD ---
app.get('/api/users', (req, res) => {
    const query = `
        SELECT u.id, u.nombre, u.apellido, u.cedula, u.correo, u.created_at, r.nombre_rol 
        FROM users u 
        JOIN roles r ON u.rol_id = r.id 
        ORDER BY u.created_at DESC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/users', async (req, res) => {
    const { nombre, apellido, cedula, correo, password, rol_id } = req.body;

    if (!nombre || !apellido || !cedula || !correo || !password || !rol_id) {
        return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        const query = `INSERT INTO users (nombre, apellido, cedula, correo, password_hash, rol_id, must_change_password) VALUES (?, ?, ?, ?, ?, ?, TRUE)`;

        db.query(query, [nombre, apellido, cedula, correo, hash, rol_id], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: "La cédula o correo ya están registrados" });
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, id: result.insertId });
        });
    } catch (err) {
        res.status(500).json({ error: "Error encriptando contraseña" });
    }
});

app.put('/api/users/change-password', async (req, res) => {
    const { id, newPassword } = req.body;
    if (!id || !newPassword) return res.status(400).json({ error: "Faltan datos" });

    try {
        const hash = await bcrypt.hash(newPassword, 10);
        const query = `UPDATE users SET password_hash = ?, must_change_password = FALSE WHERE id = ?`;

        db.query(query, [hash, id], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    } catch (e) {
        res.status(500).json({ error: "Error de servidor al encriptar" });
    }
});

app.delete('/api/users/:id', (req, res) => {
    // Prevent deleting the very first admin just to be safe
    if (req.params.id === '1') return res.status(403).json({ error: "No puedes eliminar al Super Administrador principal" });

    const query = `DELETE FROM users WHERE id = ?`;
    db.query(query, [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- ROLES CRUD ---
app.get('/api/roles', (req, res) => {
    const query = `SELECT * FROM roles ORDER BY id ASC`;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        // Ensure json parse for the frontend
        const parsed = results.map(r => ({
            ...r,
            permisos: typeof r.permisos === 'string' ? JSON.parse(r.permisos) : r.permisos
        }));
        res.json(parsed);
    });
});

app.put('/api/roles/:id', (req, res) => {
    const { permisos } = req.body;

    // Security Safeguard: Prevent modifying the root Super Admin role (ID 1)
    if (req.params.id === '1') {
        return res.status(403).json({ error: "No se pueden modificar los permisos del Super Administrador del sistema." });
    }

    const query = `UPDATE roles SET permisos = ? WHERE id = ?`;

    db.query(query, [JSON.stringify(permisos || []), req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ============================================
// API ROUTES: M5 CIERRE Y RESULTADOS
// ============================================

// Get wave results (average score from M4 checklists + current estado_final)
app.get('/api/waves/:id/results', (req, res) => {
    const waveId = req.params.id;
    // We get the participants of this wave, and their current recorded scores
    // The query calculates the average score from the checklists dynamically
    const query = `
        SELECT 
            c.id as wp_id, 
            c.id as candidate_id, 
            c.nombre_completo as nombre, 
            c.documento_id as cedula,
            c.estado_final,
            (
                SELECT IFNULL(AVG(wc.score), 0)
                FROM wave_daily_checklists wc
                WHERE wc.wave_id = ? AND wc.quiz_realizado = TRUE 
            ) as dynamic_score
        FROM candidates c
        WHERE c.wave_id = ?
    `;

    db.query(query, [waveId, waveId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Close a Wave and save final participant statuses
app.put('/api/waves/:id/close', (req, res) => {
    const waveId = req.params.id;
    const { participantes } = req.body; // Array of { wp_id, estado_final, score_promedio }

    db.beginTransaction(err => {
        if (err) return res.status(500).json({ error: err.message });

        // Update participants
        const updateParticipant = `UPDATE candidates SET estado_final = ?, score_promedio = ? WHERE id = ?`;

        let pending = participantes.length;
        if (pending === 0) {
            closeWave();
            return;
        }

        let hasError = false;
        for (let p of participantes) {
            db.query(updateParticipant, [p.estado_final, p.score_promedio, p.wp_id], (err2) => {
                if (err2 && !hasError) {
                    hasError = true;
                    return db.rollback(() => res.status(500).json({ error: err2.message }));
                }
                pending--;
                if (pending === 0 && !hasError) closeWave();
            });
        }

        function closeWave() {
            db.query(`UPDATE waves SET estado = 'finalizada' WHERE id = ?`, [waveId], (err3) => {
                if (err3) {
                    return db.rollback(() => res.status(500).json({ error: err3.message }));
                }
                db.commit(err4 => {
                    if (err4) return db.rollback(() => res.status(500).json({ error: err4.message }));
                    res.json({ success: true, message: 'Wave cerrada exitosamente' });
                });
            });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
