const express = require('express');
const { Pool } = require('pg');
const Cursor = require('pg-cursor');

// Configuración del pool de conexiones para PostgreSQL
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'db_modulo7',
  password: '1234',
  port: 5432,
});

//Inicializando el servidor Express
const app = express();
const port = 3000;

//Endpoint que utiliza pool.query para consultar saldo
app.get('/pool-query', async (req, res) => {
  const idCuenta = req.query.idCuenta || 1; // Usamos una cuenta por defecto si no se proporciona

  try {
    const result = await pool.query('SELECT saldo FROM cuentas WHERE id_cuenta = $1', [idCuenta]);
    res.json({
      message: `Saldo actual de la cuenta ${idCuenta}: ${result.rows[0].saldo}`,
      data: result.rows[0]
    });
    // ERROR TIPO JAVASCRIPT error.message error.stack //
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: 'Error al consultar el saldo',
      error: error
    });
  }
});

//Endpoint que demuestra el manejo de errores de clase 23 (violación de restricciones)
app.post('/error-clase-23', async (req, res) => {
  const idTransaccion = req.query.idTransaccion || 98765;
  const idCuenta = req.query.idCuenta || 1;
  const monto = req.query.monto || 1000;

  try {
    await pool.query('INSERT INTO transacciones (id_transaccion, id_cuenta, monto, tipo) VALUES ($1, $2, $3, $4)', 
      [idTransaccion, idCuenta, monto, 'DEPÓSITO']);
    //Happy path
    res.json({
      message: 'Transacción realizada con éxito',
      transaccion: { idTransaccion, idCuenta, monto, tipo: 'DEPÓSITO' }
    });
  } catch (error) {
    if (error.code === '23505') { // Error de clave duplicada
      res.status(400).json({
        message: 'Error: Transacción duplicada',
        error: error.message
      });
    } else {
      res.status(500).json({
        message: 'Error al realizar la operación bancaria',
        error: error.message
      });
    }
  }
});

//Endpoint que usa pg-cursor para procesar grandes volúmenes de datos (historial de transacciones)
app.get('/pg-cursor', async (req, res) => {
    const limit = parseInt(req.query.limit) || 2;
    const client = await pool.connect();
  
    try {
      const cursor = client.query(new Cursor('SELECT * FROM transacciones'));
  
      let transacciones = [];
  
      const listarTransaccionesCursor = () => {
        cursor.read(limit, (err, rows) => {
          if (err) {
            //Liberar el cliente en caso de error
            client.release(); 
            return res.status(500).json({ message: 'Error al leer las transacciones', error: err.message });
          }
  
          //Si ya no hay más registros, cerrar el cursor y devolver todos los datos
          if (rows.length === 0) {
            cursor.close(closeErr => {
              client.release(); // Liberar el cliente de la conexión
              if (closeErr) {
                return res.status(500).json({ message: 'Error al cerrar el cursor', error: closeErr.message });
              }
  
              //Devolver todos los registros que se han leído
              return res.json({
                message: `Todas las transacciones leídas ${transacciones.length}`,
                transacciones: transacciones,
              });
            });
            return;
          }
  
          //Agregar las filas obtenidas en esta lectura a la lista de todas las transacciones
          transacciones = transacciones.concat(rows);
  
          //Leer las siguientes filas
          listarTransaccionesCursor();
        });
      };
  
      //Iniciar la lectura de las transacciones
      listarTransaccionesCursor();
    } catch (err) {
      client.release();
      return res.status(500).json({ message: 'Error durante la ejecución', error: err.message });
    }
  });
  

//Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor Express escuchando en http://localhost:${port}`);
});
