require('dotenv').config();
module.exports = {
    prod: {
        username: 'root',
        password: process.env.MYSQLDB_ROOT_PASSWORD,
        database: process.env.MYSQLDB_DATABASE,
        host: 'localhost',
        port: 3307,
        dialect: 'mysql',
    },
};
