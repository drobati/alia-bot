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
    test: {
        dialect: 'sqlite',
        storage: ':memory:',
    },
    production: {
        username: 'root',
        password: process.env.DB_PASSWORD,
        database: 'aliadb',
        host: process.env.DB_HOST,
        port: 3306,
        dialect: 'mysql',
    },
};
