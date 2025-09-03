import statsCommand from './stats';

// Mock ChartJSNodeCanvas
jest.mock('chartjs-node-canvas', () => ({
    ChartJSNodeCanvas: jest.fn().mockImplementation(() => ({
        renderToBuffer: jest.fn().mockResolvedValue(Buffer.from('fake-chart-data')),
    })),
}));

describe('Stats Command', () => {
    let mockInteraction: any;
    let mockContext: any;
    let mockGuild: any;
    let mockMemberCache: any;
    let mockChannelCache: any;
    let mockRoleCache: any;

    beforeEach(() => {
        // Mock member cache
        mockMemberCache = {
            cache: {
                filter: jest.fn().mockReturnValue({ size: 25 }), // 25 online members
                size: 100, // Total members
            },
        };

        // Mock channel and role caches
        mockChannelCache = { cache: { size: 15 } };
        mockRoleCache = { cache: { size: 8 } };

        // Mock guild
        mockGuild = {
            id: 'test-guild-id',
            name: 'Test Server',
            memberCount: 100,
            members: mockMemberCache,
            channels: mockChannelCache,
            roles: mockRoleCache,
            createdAt: new Date('2020-01-01'),
            premiumTier: 2,
            premiumSubscriptionCount: 5,
            iconURL: jest.fn().mockReturnValue('https://example.com/icon.png'),
        };

        // Mock interaction
        mockInteraction = {
            guild: mockGuild,
            user: {
                id: 'test-user-id',
                username: 'testuser',
            },
            options: {
                getString: jest.fn().mockReturnValue('server'),
                getBoolean: jest.fn().mockReturnValue(false),
            },
            deferReply: jest.fn().mockResolvedValue(undefined),
            editReply: jest.fn().mockResolvedValue(undefined),
            reply: jest.fn().mockResolvedValue(undefined),
            deferred: false,
        };

        // Mock context
        mockContext = {
            log: {
                info: jest.fn(),
                error: jest.fn(),
            },
            tables: {
                Config: {
                    findAll: jest.fn(),
                },
                RollCall: {
                    findAll: jest.fn(),
                },
            },
            sequelize: {
                Op: {
                    like: Symbol('like'),
                    gte: Symbol('gte'),
                },
            },
        };

        // Set default mock return values
        (mockContext.tables.Config.findAll as jest.Mock).mockResolvedValue([]);
        (mockContext.tables.RollCall.findAll as jest.Mock).mockResolvedValue([]);
    });

    describe('Command Structure', () => {
        test('should have correct command data', () => {
            expect(statsCommand.data.name).toBe('stats');
            expect(statsCommand.data.description).toBe('Display server and bot statistics');
        });

        test('should have type option with correct choices', () => {
            const options = statsCommand.data.options;
            const typeOption = options.find((opt: any) => opt.name === 'type') as any;

            expect(typeOption).toBeDefined();
            if (typeOption && 'choices' in typeOption) {
                expect(typeOption.choices).toHaveLength(4);
                expect(typeOption.choices.map((c: any) => c.name)).toEqual([
                    'Server Overview',
                    'Bot Usage',
                    'Member Activity',
                    'All Statistics',
                ]);
            }
        });

        test('should have public option', () => {
            const options = statsCommand.data.options;
            const publicOption = options.find((opt: any) => opt.name === 'public') as any;

            expect(publicOption).toBeDefined();
            if (publicOption && 'type' in publicOption) {
                expect(publicOption.type).toBe(5); // Boolean type
            }
        });
    });

    describe('Server Stats', () => {
        test('should display server statistics correctly', async () => {
            mockInteraction.options.getString.mockReturnValue('server');

            await statsCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
            expect(mockInteraction.editReply).toHaveBeenCalled();

            const editReplyCall = mockInteraction.editReply.mock.calls[0][0];
            expect(editReplyCall.embeds).toHaveLength(1);

            const embed = editReplyCall.embeds[0];
            expect(embed.data.title).toBe('📊 Test Server Statistics');
            expect(embed.data.color).toBe(0x3498DB);
        });

        test('should calculate member statistics correctly', async () => {
            // Mock specific member filtering for bots
            mockMemberCache.cache.filter = jest.fn().mockImplementation(filterFn => {
                // First call: online members
                if (filterFn.toString().includes('presence')) {
                    return { size: 25 };
                }
                // Second call: bots
                if (filterFn.toString().includes('bot')) {
                    return { size: 5 };
                }
                return { size: 0 };
            });

            await statsCommand.execute(mockInteraction, mockContext);

            const editReplyCall = mockInteraction.editReply.mock.calls[0][0];
            const embed = editReplyCall.embeds[0];

            // Check that member statistics are included
            const memberField = embed.data.fields?.find((f: any) => f.name === '👥 Members');
            expect(memberField).toBeDefined();
            expect(memberField.value).toContain('Total:** 100');
            expect(memberField.value).toContain('Online:** 25');
        });

        test('should calculate server age correctly', async () => {
            const mockCreatedAt = new Date('2020-01-01');
            mockGuild.createdAt = mockCreatedAt;

            await statsCommand.execute(mockInteraction, mockContext);

            const editReplyCall = mockInteraction.editReply.mock.calls[0][0];
            const embed = editReplyCall.embeds[0];

            const serverInfoField = embed.data.fields?.find((f: any) => f.name === '🏠 Server Info');
            expect(serverInfoField).toBeDefined();
            expect(serverInfoField.value).toContain('Created:**');
            expect(serverInfoField.value).toContain('days ago');
        });

        test('should handle public option correctly', async () => {
            mockInteraction.options.getBoolean.mockReturnValue(true);

            await statsCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: false });
        });
    });

    describe('Bot Usage Stats', () => {
        test('should display bot usage statistics with commands', async () => {
            mockInteraction.options.getString.mockReturnValue('bot');

            // Mock command usage data
            (mockContext.tables.Config.findAll as jest.Mock).mockResolvedValue([
                { key: 'command_usage_speak', value: '50' },
                { key: 'command_usage_meme', value: '30' },
                { key: 'command_usage_fortune', value: '20' },
                { key: 'command_usage_stats', value: '10' },
            ]);

            await statsCommand.execute(mockInteraction, mockContext);

            expect(mockContext.tables.Config.findAll).toHaveBeenCalledWith({
                where: {
                    key: expect.any(Object),
                },
            });

            const editReplyCall = mockInteraction.editReply.mock.calls[0][0];
            const embed = editReplyCall.embeds[0];

            const botUsageField = embed.data.fields?.find((f: any) => f.name === '🤖 Bot Usage');
            expect(botUsageField).toBeDefined();
            expect(botUsageField.value).toContain('Total Commands:** 110');
            expect(botUsageField.value).toContain('Unique Commands:** 4');
            expect(botUsageField.value).toContain('/speak');
        });

        test('should generate chart for command usage', async () => {
            mockInteraction.options.getString.mockReturnValue('bot');

            (mockContext.tables.Config.findAll as jest.Mock).mockResolvedValue([
                { key: 'command_usage_speak', value: '50' },
                { key: 'command_usage_meme', value: '30' },
            ]);

            await statsCommand.execute(mockInteraction, mockContext);

            const editReplyCall = mockInteraction.editReply.mock.calls[0][0];
            expect(editReplyCall.files).toHaveLength(1);
            expect(editReplyCall.files[0].name).toBe('bot-usage-chart.png');
        });

        test('should handle no command usage data gracefully', async () => {
            mockInteraction.options.getString.mockReturnValue('bot');
            (mockContext.tables.Config.findAll as jest.Mock).mockResolvedValue([]);

            await statsCommand.execute(mockInteraction, mockContext);

            const editReplyCall = mockInteraction.editReply.mock.calls[0][0];
            expect(editReplyCall.files).toHaveLength(0);
        });
    });

    describe('Activity Stats', () => {
        test('should display activity statistics', async () => {
            mockInteraction.options.getString.mockReturnValue('activity');

            // Mock recent activity data
            const mockActivity = [
                { userId: 'user1', updatedAt: new Date(), guildId: 'test-guild-id' },
                { userId: 'user2', updatedAt: new Date(), guildId: 'test-guild-id' },
                { userId: 'user1', updatedAt: new Date(), guildId: 'test-guild-id' },
            ];
            (mockContext.tables.RollCall.findAll as jest.Mock).mockResolvedValue(mockActivity);

            await statsCommand.execute(mockInteraction, mockContext);

            expect(mockContext.tables.RollCall.findAll).toHaveBeenCalledWith({
                where: {
                    guildId: 'test-guild-id',
                    updatedAt: expect.any(Object),
                },
                order: [['updatedAt', 'DESC']],
            });

            const editReplyCall = mockInteraction.editReply.mock.calls[0][0];
            const embed = editReplyCall.embeds[0];

            const activityField = embed.data.fields?.find((f: any) => f.name === '📈 Activity (Last 7 Days)');
            expect(activityField).toBeDefined();
            expect(activityField.value).toContain('Active Members:** 2');
            expect(activityField.value).toContain('Total Activity:** 3');
        });

        test('should generate activity chart', async () => {
            mockInteraction.options.getString.mockReturnValue('activity');

            (mockContext.tables.RollCall.findAll as jest.Mock).mockResolvedValue([
                { userId: 'user1', updatedAt: new Date(), guildId: 'test-guild-id' },
            ]);

            await statsCommand.execute(mockInteraction, mockContext);

            const editReplyCall = mockInteraction.editReply.mock.calls[0][0];
            expect(editReplyCall.files).toHaveLength(1);
            expect(editReplyCall.files[0].name).toBe('activity-chart.png');
        });

        test('should handle no activity data gracefully', async () => {
            mockInteraction.options.getString.mockReturnValue('activity');
            (mockContext.tables.RollCall.findAll as jest.Mock).mockResolvedValue([]);

            await statsCommand.execute(mockInteraction, mockContext);

            const editReplyCall = mockInteraction.editReply.mock.calls[0][0];
            expect(editReplyCall.files).toHaveLength(0);
        });
    });

    describe('All Stats', () => {
        test('should display all statistics types', async () => {
            mockInteraction.options.getString.mockReturnValue('all');

            (mockContext.tables.Config.findAll as jest.Mock).mockResolvedValue([
                { key: 'command_usage_speak', value: '50' },
            ]);
            (mockContext.tables.RollCall.findAll as jest.Mock).mockResolvedValue([
                { userId: 'user1', updatedAt: new Date(), guildId: 'test-guild-id' },
            ]);

            await statsCommand.execute(mockInteraction, mockContext);

            const editReplyCall = mockInteraction.editReply.mock.calls[0][0];
            const embed = editReplyCall.embeds[0];

            // Should have all field types
            expect(embed.data.fields?.some((f: any) => f.name === '👥 Members')).toBe(true);
            expect(embed.data.fields?.some((f: any) => f.name === '🏠 Server Info')).toBe(true);
            expect(embed.data.fields?.some((f: any) => f.name === '🤖 Bot Usage')).toBe(true);
            expect(embed.data.fields?.some((f: any) => f.name === '📈 Activity (Last 7 Days)')).toBe(true);

            // Should have both chart types
            expect(editReplyCall.files).toHaveLength(2);
            expect(editReplyCall.files.some((f: any) => f.name === 'bot-usage-chart.png')).toBe(true);
            expect(editReplyCall.files.some((f: any) => f.name === 'activity-chart.png')).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('should handle missing guild', async () => {
            mockInteraction.guild = null;

            await statsCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                content: '❌ This command can only be used in a server.',
            });
        });

        test('should handle database errors gracefully', async () => {
            const dbError = new Error('Database connection failed');
            mockInteraction.deferReply.mockRejectedValue(dbError);

            await statsCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalledWith('Stats command failed', {
                userId: 'test-user-id',
                error: dbError,
            });

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: '❌ Failed to generate statistics. Please try again later.',
                ephemeral: true,
            });
        });

        test('should handle reply before defer', async () => {
            const replyError = new Error('Interaction already replied');
            mockInteraction.deferReply.mockRejectedValue(replyError);
            mockInteraction.deferred = false;

            await statsCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: '❌ Failed to generate statistics. Please try again later.',
                ephemeral: true,
            });
        });

        test('should handle chart generation errors', async () => {
            mockInteraction.options.getString.mockReturnValue('bot');

            // Mock database error to trigger the catch block
            (mockContext.tables.Config.findAll as jest.Mock).mockRejectedValue(new Error('Chart generation failed'));

            await statsCommand.execute(mockInteraction, mockContext);

            // Should still complete successfully without chart
            expect(mockInteraction.editReply).toHaveBeenCalled();
            expect(mockContext.log.error).toHaveBeenCalledWith('Error generating bot usage stats:', expect.any(Error));
        });
    });

    describe('Logging', () => {
        test('should log successful command execution', async () => {
            await statsCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith('Stats command executed', {
                userId: 'test-user-id',
                username: 'testuser',
                guildId: 'test-guild-id',
                statsType: 'server',
                isPublic: false,
            });
        });

        test('should log errors with user context', async () => {
            const error = new Error('Test error');
            mockInteraction.deferReply.mockRejectedValue(error);

            await statsCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalledWith('Stats command failed', {
                userId: 'test-user-id',
                error: error,
            });
        });
    });

    describe('Data Processing', () => {
        test('should correctly calculate command percentages', async () => {
            mockInteraction.options.getString.mockReturnValue('bot');

            (mockContext.tables.Config.findAll as jest.Mock).mockResolvedValue([
                { key: 'command_usage_speak', value: '80' }, // 80%
                { key: 'command_usage_meme', value: '20' },  // 20%
            ]);

            await statsCommand.execute(mockInteraction, mockContext);

            const editReplyCall = mockInteraction.editReply.mock.calls[0][0];
            const embed = editReplyCall.embeds[0];

            const botUsageField = embed.data.fields?.find((f: any) => f.name === '🤖 Bot Usage');
            expect(botUsageField.value).toContain('80.0%');
            expect(botUsageField.value).toContain('20.0%');
        });

        test('should sort commands by usage count', async () => {
            mockInteraction.options.getString.mockReturnValue('bot');

            (mockContext.tables.Config.findAll as jest.Mock).mockResolvedValue([
                { key: 'command_usage_fortune', value: '5' },
                { key: 'command_usage_speak', value: '50' },
                { key: 'command_usage_meme', value: '25' },
            ]);

            await statsCommand.execute(mockInteraction, mockContext);

            const editReplyCall = mockInteraction.editReply.mock.calls[0][0];
            const embed = editReplyCall.embeds[0];

            const botUsageField = embed.data.fields?.find((f: any) => f.name === '🤖 Bot Usage');

            // Should be ordered by count: speak (50), meme (25), fortune (5)
            const lines = botUsageField.value.split('\n');
            expect(lines.find((l: string) => l.includes('1.**'))).toContain('/speak');
            expect(lines.find((l: string) => l.includes('2.**'))).toContain('/meme');
            expect(lines.find((l: string) => l.includes('3.**'))).toContain('/fortune');
        });

        test('should handle invalid command usage values', async () => {
            mockInteraction.options.getString.mockReturnValue('bot');

            (mockContext.tables.Config.findAll as jest.Mock).mockResolvedValue([
                { key: 'command_usage_speak', value: 'invalid' },
                { key: 'command_usage_meme', value: null },
                { key: 'command_usage_fortune', value: '10' },
            ]);

            await statsCommand.execute(mockInteraction, mockContext);

            // Should handle gracefully and not crash
            expect(mockInteraction.editReply).toHaveBeenCalled();
        });
    });
});