require('dotenv').config();
module.exports = {
    development: {
        username: process.env.MYSQLDB_USER || 'aliabot',
        password: process.env.MYSQLDB_PASSWORD || 'aliabot123',
        database: process.env.MYSQLDB_DATABASE || 'aliadb',
        host: 'localhost',
        port: process.env.MYSQLDB_LOCAL_PORT || 3307,
        dialect: 'mysql',
    },
    prod: {
        username: 'root',
        password: process.env.MYSQLDB_ROOT_PASSWORD,
        database: process.env.MYSQLDB_DATABASE,
        host: 'localhost',
        port: 3307,
        dialect: 'mysql',
    },
};
