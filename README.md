
# Introducción al Módulo pg y el Uso de pool.query

El módulo `pg` es una biblioteca de Node.js que permite interactuar con bases de datos PostgreSQL. Utiliza un sistema de conexiones de tipo pool, lo que mejora la eficiencia al manejar múltiples consultas simultáneamente. Este enfoque es particularmente útil en escenarios de transacciones bancarias donde se procesan grandes volúmenes de datos, como transferencias, depósitos y consultas de saldos.

## Uso de `pool.query`

Cuando realizas consultas con `pool.query`, obtienes un objeto `result` que contiene varias propiedades útiles, particularmente en el contexto de transacciones bancarias:

- **result.rows**: Un arreglo que contiene las filas devueltas por la consulta, como detalles de cuentas bancarias o transacciones. Cada fila es un objeto donde las claves corresponden a los nombres de las columnas (por ejemplo, `id_cuenta`, `monto`, `fecha_transaccion`).
  
- **result.fields**: Un arreglo de objetos que describe las columnas de la consulta, incluyendo información como el nombre y el tipo de datos. Es útil para verificar si los tipos de datos en la respuesta coinciden con lo esperado (por ejemplo, fechas o montos).
  
- **result.command**: Una cadena que indica el tipo de comando SQL ejecutado (`SELECT`, `INSERT`, `UPDATE`, `DELETE`). Esto es útil para auditar las transacciones ejecutadas.

- **result.rowCount**: Indica cuántas filas han sido afectadas por la consulta. Es especialmente útil para verificar el éxito de una operación, como una transferencia bancaria o un retiro.

### Ejemplo de Consulta de Saldo

```javascript
const { Pool } = require('pg');
const pool = new Pool({
  user: 'banco_user',
  host: 'localhost',
  database: 'banco_db',
  password: 'password_segura',
  port: 5432,
});

pool.query('SELECT saldo FROM cuentas WHERE id_cuenta = $1', [123456])
  .then(result => {
    console.log(`Saldo actual: ${result.rows[0].saldo}`); // Muestra el saldo de la cuenta
  })
  .catch(error => {
    console.error('Error al consultar el saldo', error);
  });
```

## Errores de Clase 23 - Violación de Restricción de Integridad en Transacciones Bancarias

### Errores Generalmente para INSERTS y UPDATES

En el contexto de transacciones financieras, los errores de clase 23 son críticos ya que se refieren a violaciones de restricciones de integridad de la base de datos. Por ejemplo:

- **Violación de clave primaria**: Ocurre al intentar registrar una transacción con un ID de transacción que ya existe.
- **Violación de clave foránea**: Sucede si intentas realizar una transferencia desde una cuenta que no existe.
- **Violación de restricciones de unicidad**: Ocurre si intentas duplicar registros únicos, como un número de cuenta.

# Errores de Clase 23 - Violación de Restricciones de Integridad en PostgreSQL

| Código de Error | Nombre del Error                           | Descripción                                                                                       | Ejemplo en Transacciones Bancarias                                                    |
|-----------------|--------------------------------------------|---------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------|
| **23502**       | **Violación de restricción NOT NULL**      | Se ha intentado insertar o actualizar una columna con un valor `NULL` en una columna que no permite `NULL`. | **Ejemplo:** Intentar crear una cuenta bancaria sin especificar el `id_cuenta`. <br> **Consulta:** `INSERT INTO cuentas (saldo) VALUES (1000);` <br> **Error:** Falta el `id_cuenta` que no permite `NULL`. |
| **23503**       | **Violación de clave foránea**             | Se ha intentado insertar o actualizar un valor que no existe en la tabla referenciada por la clave foránea. | **Ejemplo:** Intentar registrar una transacción para una `id_cuenta` que no existe en la tabla `cuentas`. <br> **Consulta:** `INSERT INTO transacciones (id_transaccion, id_cuenta, monto, tipo) VALUES (1, 999999, 500, 'DEPÓSITO');` <br> **Error:** La `id_cuenta` 999999 no existe en `cuentas`. |
| **23505**       | **Violación de restricción de unicidad**   | Se ha intentado insertar o actualizar un valor que viola una restricción `UNIQUE`. Esto ocurre cuando se inserta un valor duplicado en una columna que requiere valores únicos. | **Ejemplo:** Intentar registrar dos transacciones con el mismo `id_transaccion`. <br> **Consulta 1:** `INSERT INTO transacciones (id_transaccion, id_cuenta, monto, tipo) VALUES (1, 123456, 500, 'DEPÓSITO');` <br> **Consulta 2:** `INSERT INTO transacciones (id_transaccion, id_cuenta, monto, tipo) VALUES (1, 123456, 300, 'RETIRO');` <br> **Error:** El `id_transaccion` 1 ya existe. |
| **23514**       | **Violación de restricción CHECK**         | Se ha violado una condición `CHECK` definida en la base de datos, que valida que los datos cumplen con ciertas condiciones. | **Ejemplo:** Intentar registrar una transacción con un monto negativo si la restricción `CHECK` solo permite montos positivos. <br> **Consulta:** `INSERT INTO transacciones (id_transaccion, id_cuenta, monto, tipo) VALUES (2, 123456, -100, 'RETIRO');` <br> **Error:** El monto no puede ser negativo. |
| **23P01**       | **Violación de restricción excluyente**    | Se ha violado una restricción `EXCLUDE`, que impide que ciertos conjuntos de datos coincidan bajo ciertas condiciones, generalmente mediante operadores. | **Ejemplo:** Intentar crear una cuenta bancaria con el mismo número de cuenta en diferentes monedas si existe una restricción que lo prohíbe. <br> **Consulta:** `INSERT INTO cuentas (id_cuenta, numero_cuenta, moneda, saldo) VALUES (2, 'ABC123', 'USD', 1000);` <br> **Consulta Posterior:** `INSERT INTO cuentas (id_cuenta, numero_cuenta, moneda, saldo) VALUES (3, 'ABC123', 'USD', 2000);` <br> **Error:** La combinación de `numero_cuenta` y `moneda` ya existe. |
| **23000**       | **Violación de restricción de integridad** | Se refiere a la violación genérica de cualquier tipo de restricción impuesta en la base de datos. | **Ejemplo:** Cualquier violación de las restricciones específicas mencionadas anteriormente puede clasificarse bajo esta categoría genérica. |
| **23001**       | **Violación de restricción de verificación** | Se ha violado una cláusula `CHECK` definida en la tabla. Similar a 23514 pero puede aplicarse a otras verificaciones más generales. | **Ejemplo:** Intentar registrar una transacción fuera del horario permitido si existe una restricción de `CHECK` que valida la hora de la transacción. <br> **Consulta:** `INSERT INTO transacciones (id_transaccion, id_cuenta, monto, tipo, hora) VALUES (4, 123456, 500, 'DEPÓSITO', '25:00');` <br> **Error:** La hora de la transacción no es válida. |




### Ejemplo de Manejo de Errores: Depósito Duplicado

```javascript
pool.query('INSERT INTO transacciones (id_transaccion, id_cuenta, monto, tipo) VALUES ($1, $2, $3, $4)', 
[98765, 123456, 1000, 'DEPÓSITO'])
  .then(result => {
    console.log('Transacción realizada con éxito', result.rowCount);
  })
  .catch(error => {
    if (error.code === '23505') {
      console.error('Error: Transacción duplicada');
    } if else(error.code === '23502'){
        console.error('Error: Se está ingresando un campo sin valor')
    } else {
      console.error('Error en la operación bancaria', error);
    }
  });
```



## Introducción al Módulo pg-cursor en el Manejo de Grandes Conjuntos de Transacciones

El módulo `pg-cursor` es útil para manejar grandes volúmenes de datos financieros, como cuando procesas muchas transacciones bancarias o consultas el historial de una cuenta con cientos o miles de operaciones. Utiliza cursores para leer resultados en partes, evitando problemas de memoria.

### ¿Qué son los cursores?

En bases de datos, un cursor permite iterar sobre un conjunto de resultados de una consulta de manera eficiente. Esto es útil cuando necesitas procesar datos financieros gradualmente, como en auditorías de cuentas bancarias.

### ¿Cuándo utilizar cursores?

Utiliza cursores cuando:

- Necesitas consultar y procesar el historial completo de transacciones de una cuenta bancaria sin cargar todos los datos en memoria.
- Estás auditando grandes volúmenes de datos financieros.

### Ejemplo: Consulta de Historial de Transacciones

```javascript
const Cursor = require('pg-cursor');

const cursor = new Cursor('SELECT * FROM transacciones WHERE id_cuenta BETWEEN $1 AND $2', [111111,123456]);
pool.connect((err, client, done) => {
  if (err) throw err;

  client.query(cursor);

 //Depende del tamaño de las filas que me devuelve será (Mientras fila más pequeña este número tiende a disminuir )
  cursor.read(20, (err, rows) => {
    if (err) throw err;
    console.log('10 transacciones:', rows); // Procesa 10 transacciones a la vez

    // Cerrar el cursor
    cursor.close(err => {
      if (err) console.error('Error al cerrar el cursor', err);
      done(); // Libera la conexión
    });
  });
});
```

### Cierre de Cursores

Es importante cerrar los cursores después de usarlos para liberar recursos en el servidor y evitar problemas de rendimiento, especialmente en operaciones bancarias donde la seguridad y la eficiencia son esenciales.

```javascript
cursor.close(err => {
  if (err) {
    console.error('Error al cerrar el cursor', err);
  } else {
    console.log('Cursor cerrado correctamente');
  }
});
```

## Conclusión

El uso del módulo `pg` y `pg-cursor` en aplicaciones bancarias permite manejar consultas simples y complejas de manera eficiente. `pool.query` es ideal para consultas directas como la verificación de saldo, mientras que `pg-cursor` resulta útil para procesar grandes volúmenes de transacciones. Aplicar estas técnicas mejora el rendimiento y la seguridad de las aplicaciones financieras.
```
