docker run \
    --name mysql-container \
    -e MYSQL_DATABASE=$MYSQLDB_DATABASE \
    -e MYSQL_USER=$MYSQLDB_USER \
    -e MYSQL_PASSWORD=$MYSQLDB_PASSWORD \
    -e MYSQL_ROOT_PASSWORD=$MYSQLDB_ROOT_PASSWORD \
    -p $MYSQLDB_DOCKER_PORT:$MYSQLDB_LOCAL_PORT \
    -d mysql
    # -v $pwd/$MYSQLDB_DATABASE:/var/lib/mysql
