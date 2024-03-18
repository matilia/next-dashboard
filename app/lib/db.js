const { Pool } = require('pg');

let connection;

if(!connection){
    connection = new Pool({
        user: "postgres",
        password: "Gracemkanusu9595",
        host: "localhost",
        port: 5432,
        database: "next-dashboard",
    })
}

module.exports = {
    query: (text, params) => connection.query(text, params),
    connection,
};

