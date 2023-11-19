function createInteraction() {
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

function createContext() {
    return {
        tables: {},
        log: { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() },
        VERSION: 'fake-version',
        sequelize: {
            transaction: jest.fn(async transactionCallback => {
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

function createTable() {
    return {
        findAll: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
        destroy: jest.fn(),
    };
}

function createRecord(values) {
    return {
        ...values,
        update: jest.fn(),
        destroy: jest.fn(),
    };
}

module.exports = {
    createInteraction,
    createContext,
    createTable,
    createRecord,
};