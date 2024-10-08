const express = require('express');
const pool = require('./conexion_db.js')
const Cursor = require('pg-cursor');
const app = express();
//agregar JSON en el body de las peticiones
app.use(express.json());


const insertUsuario = async (nombre, email) => {
  const client = await pool.connect();
  try {
    const queryText = 'INSERT INTO usuarios (nombre, email) VALUES ($1, $2) RETURNING *';
    const result = await client.query(queryText, [nombre, email]);
    return result.rows[0];
  } finally {
    client.release();
  }
};

const updateUsuario = async (id, nombre, email) => {
  const client = await pool.connect();
  try {
    const queryText = 'UPDATE usuarios SET nombre = $1, email = $2 WHERE id = $3 RETURNING *';
    const result = await client.query(queryText, [nombre, email, id]);
    return result.rows[0];
  } finally {
    client.release();
  }
};

const deleteUsuario = async (id) => {
  const client = await pool.connect();
  try {
    const queryText = 'DELETE FROM usuarios WHERE id = $1 RETURNING *';
    const result = await client.query(queryText, [id]);
    return result.rows[0];
  } finally {
    client.release();
  }
};

const getUsuarioById = async (id) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    return result.rows[0];
  } finally {
    client.release();
  }
};

const getUsuariosConCursor = async (limit) => {
  const client = await pool.connect();
  const cursor = client.query(new Cursor('SELECT * FROM usuarios ORDER BY id'));
  return new Promise((resolve, reject) => {
    cursor.read(limit, (err, rows) => {
      if (err) {
        client.release();
        return reject(err);
      }
      cursor.close((closeErr) => {
        client.release();
        if (closeErr) return reject(closeErr);
        resolve(rows);
      });
    });
  });
};

//Crear Usuario
app.post('/usuarios', (req, res) => {
    const { nombre, email } = req.body;
    insertUsuario(nombre, email)
      .then(usuario => res.status(201).json(usuario))
      .catch(error => {
        //Violación de restricción de unicidad
        if (error.code === '23505') { 
          return res.status(400).json({ message: 'Error: El email ya existe.', error: error.message });
        }
        res.status(500).json({ message: 'Error al insertar usuario', error: error.message });
      });
  });
  
//Modificar Usuario
app.put('/usuarios/:id', (req, res) => {
  const { id } = req.params;
  //nueva información
  const { nombre, email } = req.body;
  updateUsuario(id, nombre, email)
    .then(usuario => {
      if (usuario) {
        //timestamps escondidos (cuándo se creó, cuándo se modificó)
        res.json(usuario);
      } else {
        res.status(404).json({ message: 'Usuario no encontrado' });
      }
    })
    .catch(error => {
      //Violación de restricción de unicidad
      if (error.code === '23505') { 
        return res.status(400).json({ message: 'Error: El email ya existe.', error: error.message });
      }
      res.status(500).json({ message: 'Error al actualizar usuario', error: error.message });
    });
});

app.delete('/usuarios/:id', (req, res) => {
  const { id } = req.params;
  deleteUsuario(id)
    .then(usuario => {
      if (usuario) {
        res.json({ message: 'Usuario eliminado', usuario });
      } else {
        res.status(404).json({ message: 'Usuario no encontrado' });
      }
    })
    .catch(error => {
      res.status(500).json({ message: 'Error al eliminar usuario', error: error.message });
    });
});

app.get('/usuarios/:id', (req, res) => {
  const { id } = req.params;
  getUsuarioById(id)
    .then(usuario => {
      if (usuario) {
        res.json(usuario);
      } else {
        res.status(404).json({ message: 'Usuario no encontrado' });
      }
    })
    .catch(error => {
      res.status(500).json({ message: 'Error al obtener usuario', error: error.message });
    });
});

app.get('/usuarios', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  getUsuariosConCursor(limit)
    .then(usuarios => res.json({
      message: `Se han leído ${usuarios.length} usuarios.`,
      usuarios
    }))
    .catch(error => {
      res.status(500).json({ message: 'Error al obtener usuarios', error: error.message });
    });
});

//Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});