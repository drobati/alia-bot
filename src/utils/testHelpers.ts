export function createInteraction() {
    return {
        user: {
            id: 'fake-user-id',
        },
        options: {
            get: jest.fn(),
            getFocused: jest.fn(),
            getInteger: jest.fn(),
            getNumber: jest.fn(),
            getString: jest.fn(),
            getSubcommand: jest.fn(),
        },
        reply: jest.fn().mockResolvedValue(true),
        respond: jest.fn(),
    };
}

export function createContext() {
    return {
        tables: {},
        log: { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() },
        VERSION: 'fake-version',
        sequelize: {
            transaction: jest.fn(async (transactionCallback: any) => {
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
        upsert: jest.fn().mockResolvedValue([{}, true]), // Returns [record, created]
        findOrCreate: jest.fn().mockResolvedValue([{}, true]), // Returns [record, created]
        destroy: jest.fn(),
        count: jest.fn(),
    };
}

export function createRecord(values: any) {
    return {
        ...values,
        update: jest.fn(),
        destroy: jest.fn(),
    };
}