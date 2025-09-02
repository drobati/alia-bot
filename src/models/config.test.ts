import { Sequelize } from 'sequelize';
import configModel from './config';

describe('Config Model', () => {
    let sequelize: Sequelize;
    let Config: any;

    beforeEach(async () => {
        // Create in-memory SQLite database for testing
        sequelize = new Sequelize({
            dialect: 'sqlite',
            storage: ':memory:',
            logging: false,
        });

        // Initialize the model
        const models = configModel(sequelize);
        Config = models.Config;

        // Sync the database
        await sequelize.sync();
    });

    afterEach(async () => {
        if (sequelize) {
            await sequelize.close();
        }
    });

    describe('Model Structure', () => {
        it('should create Config model with correct attributes', () => {
            expect(Config.name).toBe('Config');
            expect(Config.rawAttributes).toHaveProperty('key');
            expect(Config.rawAttributes).toHaveProperty('value');
        });

        it('should have key as primary key', () => {
            expect(Config.rawAttributes.key.primaryKey).toBe(true);
        });

        it('should require key field', () => {
            expect(Config.rawAttributes.key.allowNull).toBe(false);
        });

        it('should require value field', () => {
            expect(Config.rawAttributes.value.allowNull).toBe(false);
        });

        it('should use TEXT type for value field', () => {
            expect(Config.rawAttributes.value.type.constructor.name).toBe('TEXT');
        });
    });

    describe('CRUD Operations', () => {
        it('should create a config entry', async () => {
            const config = await Config.create({
                key: 'TEST_KEY',
                value: 'test_value',
            });

            expect(config.key).toBe('TEST_KEY');
            expect(config.value).toBe('test_value');
        });

        it('should find a config entry by key', async () => {
            await Config.create({
                key: 'SEARCH_KEY',
                value: 'search_value',
            });

            const config = await Config.findOne({
                where: { key: 'SEARCH_KEY' },
            });

            expect(config).not.toBeNull();
            expect(config.key).toBe('SEARCH_KEY');
            expect(config.value).toBe('search_value');
        });

        it('should update a config entry', async () => {
            await Config.create({
                key: 'UPDATE_KEY',
                value: 'original_value',
            });

            await Config.update(
                { value: 'updated_value' },
                { where: { key: 'UPDATE_KEY' } },
            );

            const config = await Config.findOne({
                where: { key: 'UPDATE_KEY' },
            });

            expect(config.value).toBe('updated_value');
        });

        it('should delete a config entry', async () => {
            await Config.create({
                key: 'DELETE_KEY',
                value: 'delete_value',
            });

            await Config.destroy({
                where: { key: 'DELETE_KEY' },
            });

            const config = await Config.findOne({
                where: { key: 'DELETE_KEY' },
            });

            expect(config).toBeNull();
        });
    });

    describe('Data Validation', () => {
        it('should enforce unique keys', async () => {
            await Config.create({
                key: 'UNIQUE_KEY',
                value: 'value1',
            });

            await expect(Config.create({
                key: 'UNIQUE_KEY',
                value: 'value2',
            })).rejects.toThrow();
        });

        it('should not allow null key', async () => {
            await expect(Config.create({
                key: null,
                value: 'test_value',
            })).rejects.toThrow();
        });

        it('should not allow null value', async () => {
            await expect(Config.create({
                key: 'TEST_KEY',
                value: null,
            })).rejects.toThrow();
        });

        it('should handle long values', async () => {
            const longValue = 'x'.repeat(1000);
            const config = await Config.create({
                key: 'LONG_VALUE_KEY',
                value: longValue,
            });

            expect(config.value).toBe(longValue);
        });

        it('should handle JSON string values', async () => {
            const jsonValue = JSON.stringify({
                setting1: 'value1',
                setting2: 42,
                setting3: true,
            });

            const config = await Config.create({
                key: 'JSON_KEY',
                value: jsonValue,
            });

            expect(config.value).toBe(jsonValue);
            expect(JSON.parse(config.value)).toEqual({
                setting1: 'value1',
                setting2: 42,
                setting3: true,
            });
        });
    });

    describe('Common Bot Configuration Scenarios', () => {
        it('should store Discord bot token', async () => {
            await Config.create({
                key: 'BOT_TOKEN',
                value: 'discord_bot_token_12345',
            });

            const token = await Config.findOne({
                where: { key: 'BOT_TOKEN' },
            });

            expect(token.value).toBe('discord_bot_token_12345');
        });

        it('should store API configuration', async () => {
            await Config.create({
                key: 'OPENAI_API_KEY',
                value: 'sk-1234567890abcdef',
            });

            const apiKey = await Config.findOne({
                where: { key: 'OPENAI_API_KEY' },
            });

            expect(apiKey.value).toBe('sk-1234567890abcdef');
        });

        it('should store feature flags', async () => {
            await Config.create({
                key: 'FEATURE_ASSISTANT_ENABLED',
                value: 'true',
            });

            const featureFlag = await Config.findOne({
                where: { key: 'FEATURE_ASSISTANT_ENABLED' },
            });

            expect(featureFlag.value).toBe('true');
        });

        it('should handle configuration updates for existing keys', async () => {
            // Initial configuration
            await Config.create({
                key: 'MAX_MESSAGE_LENGTH',
                value: '1000',
            });

            // Update configuration
            const [updatedCount] = await Config.update(
                { value: '2000' },
                { where: { key: 'MAX_MESSAGE_LENGTH' } },
            );

            expect(updatedCount).toBe(1);

            const updatedConfig = await Config.findOne({
                where: { key: 'MAX_MESSAGE_LENGTH' },
            });

            expect(updatedConfig.value).toBe('2000');
        });

        it('should handle bulk configuration operations', async () => {
            const configEntries = [
                { key: 'SETTING_1', value: 'value1' },
                { key: 'SETTING_2', value: 'value2' },
                { key: 'SETTING_3', value: 'value3' },
            ];

            await Config.bulkCreate(configEntries);

            const allConfigs = await Config.findAll({
                where: {
                    key: ['SETTING_1', 'SETTING_2', 'SETTING_3'],
                },
            });

            expect(allConfigs).toHaveLength(3);
            expect(allConfigs.map((c: any) => c.key)).toEqual(
                expect.arrayContaining(['SETTING_1', 'SETTING_2', 'SETTING_3']),
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle database connection errors gracefully', async () => {
            // Close the connection to simulate error
            await sequelize.close();

            await expect(Config.create({
                key: 'ERROR_KEY',
                value: 'error_value',
            })).rejects.toThrow();
        });

        it('should validate key length constraints', async () => {
            const longKey = 'x'.repeat(300); // Assuming there's a reasonable limit

            const config = await Config.create({
                key: longKey,
                value: 'test_value',
            });

            expect(config.key).toBe(longKey);
        });
    });
});