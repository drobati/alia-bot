/* eslint-disable no-unused-vars */
export function createInteraction() {
    return {
        user: {
            id: 'fake-user-id',
        },
        guildId: null as string | null,
        options: {
            get: jest.fn(),
            getChannel: jest.fn(),
            getFocused: jest.fn(),
            getInteger: jest.fn(),
            getNumber: jest.fn(),
            getRole: jest.fn(),
            getString: jest.fn(),
            getSubcommand: jest.fn(),
            getSubcommandGroup: jest.fn(),
        },
        reply: jest.fn().mockResolvedValue(true),
        respond: jest.fn(),
    };
}

export function createContext() {
    return {
        tables: {} as Record<string, ReturnType<typeof createTable>>,
        log: { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() },
        VERSION: 'fake-version',
        sequelize: {
            transaction: jest.fn(async (transactionCallback: (t: unknown) => Promise<unknown>) => {
                // Mock transaction object
                const mockTransaction = {
                    commit: jest.fn(),
                    rollback: jest.fn(),
                };

                // Execute the transaction callback with the mock transaction
                return await transactionCallback(mockTransaction);
            }),
        },
    };
}

export function createTable() {
    return {
        findAll: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn().mockResolvedValue([{}, true]), // Returns [record, created]
        findOrCreate: jest.fn().mockResolvedValue([{}, true]), // Returns [record, created]
        destroy: jest.fn(),
        count: jest.fn(),
    };
}

export function createRecord(values: Record<string, unknown>) {
    return {
        ...values,
        update: jest.fn(),
        destroy: jest.fn(),
    };
}