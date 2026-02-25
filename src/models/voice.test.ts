import { Sequelize } from 'sequelize';
import voiceModel from './voice';

describe('Voice Model', () => {
    let sequelize: Sequelize;
    let Voice: any;

    beforeEach(async () => {
        sequelize = new Sequelize({
            dialect: 'sqlite',
            storage: ':memory:',
            logging: false,
        });

        const models = voiceModel(sequelize);
        Voice = models.Voice;
        await sequelize.sync();
    });

    afterEach(async () => {
        if (sequelize) {
            try {
                await sequelize.close();
            } catch {
                // Ignore close errors
            }
        }
    });

    describe('Model Structure', () => {
        it('should create Voice model with correct attributes', () => {
            expect(Voice.name).toBe('voices');
            expect(Voice.rawAttributes).toHaveProperty('name');
            expect(Voice.rawAttributes).toHaveProperty('voiceId');
            expect(Voice.rawAttributes).toHaveProperty('description');
        });

        it('should have name as unique and not null', () => {
            expect(Voice.rawAttributes.name.unique).toBe(true);
            expect(Voice.rawAttributes.name.allowNull).toBe(false);
        });

        it('should have voiceId as not null', () => {
            expect(Voice.rawAttributes.voiceId.allowNull).toBe(false);
        });

        it('should have description as not null', () => {
            expect(Voice.rawAttributes.description.allowNull).toBe(false);
        });
    });

    describe('CRUD Operations', () => {
        it('should create a voice entry', async () => {
            const voice = await Voice.create({
                name: 'morgan',
                voiceId: 'abc123',
                description: 'Deep smooth narrator',
            });

            expect(voice.name).toBe('morgan');
            expect(voice.voiceId).toBe('abc123');
            expect(voice.description).toBe('Deep smooth narrator');
        });

        it('should find a voice by name', async () => {
            await Voice.create({
                name: 'alice',
                voiceId: 'def456',
                description: 'Soft female voice',
            });

            const voice = await Voice.findOne({ where: { name: 'alice' } });
            expect(voice).not.toBeNull();
            expect(voice.voiceId).toBe('def456');
        });

        it('should list all voices', async () => {
            await Voice.create({ name: 'alice', voiceId: 'id1', description: 'Voice 1' });
            await Voice.create({ name: 'bob', voiceId: 'id2', description: 'Voice 2' });

            const voices = await Voice.findAll({ order: [['name', 'ASC']] });
            expect(voices).toHaveLength(2);
            expect(voices[0].name).toBe('alice');
            expect(voices[1].name).toBe('bob');
        });

        it('should delete a voice', async () => {
            await Voice.create({ name: 'temp', voiceId: 'id1', description: 'Temporary' });

            const deleted = await Voice.destroy({ where: { name: 'temp' } });
            expect(deleted).toBe(1);

            const voice = await Voice.findOne({ where: { name: 'temp' } });
            expect(voice).toBeNull();
        });

        it('should return 0 when deleting nonexistent voice', async () => {
            const deleted = await Voice.destroy({ where: { name: 'nonexistent' } });
            expect(deleted).toBe(0);
        });
    });

    describe('Data Validation', () => {
        it('should enforce unique names', async () => {
            await Voice.create({ name: 'morgan', voiceId: 'id1', description: 'First' });
            await expect(
                Voice.create({ name: 'morgan', voiceId: 'id2', description: 'Second' }),
            ).rejects.toThrow();
        });

        it('should reject null name', async () => {
            await expect(
                Voice.create({ name: null, voiceId: 'id1', description: 'Test' }),
            ).rejects.toThrow();
        });

        it('should reject null voiceId', async () => {
            await expect(
                Voice.create({ name: 'test', voiceId: null, description: 'Test' }),
            ).rejects.toThrow();
        });

        it('should reject null description', async () => {
            await expect(
                Voice.create({ name: 'test', voiceId: 'id1', description: null }),
            ).rejects.toThrow();
        });
    });
});
