import { DataTypes, Model, Sequelize, InferAttributes, InferCreationAttributes } from "sequelize";

interface TwitchUsersModel extends Model<InferAttributes<TwitchUsersModel>, InferCreationAttributes<TwitchUsersModel>> {
    user_id: string;
    twitch_id: string;
    twitch_username: string;
}

interface TwitchNotificationsModel
    extends Model<InferAttributes<TwitchNotificationsModel>, InferCreationAttributes<TwitchNotificationsModel>> {
    notification_id: number;
}

export default (sequelize: Sequelize) => ({
    Twitch_Users: sequelize.define<TwitchUsersModel>('twitch_users', {
        user_id: {
            type: DataTypes.STRING,
            unique: true,
        },
        twitch_id: {
            type: DataTypes.STRING,
            unique: true,
        },
        twitch_username: {
            type: DataTypes.STRING,
            unique: true,
        },
    }),
    Twitch_Notifications: sequelize.define<TwitchNotificationsModel>('twitch_notifications', {
        notification_id: {
            type: DataTypes.INTEGER,
            unique: true,
        },
    }),
})
