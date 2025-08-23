/* eslint-disable no-unused-vars */
// Database type definitions

// Database model interfaces
export interface AdlibsAttributes {
    id?: number;
    key: string;
    value: string;
    username: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ConfigAttributes {
    id?: number;
    key: string;
    value: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface LoudsAttributes {
    id?: number;
    message: string;
    username: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface LoudsBannedAttributes {
    id?: number;
    message: string;
    username: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface MemoriesAttributes {
    id?: number;
    key: string;
    value: string;
    read_count?: number;
    triggered?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface RollCallAttributes {
    id?: number;
    username: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface TwitchAttributes {
    id?: number;
    key: string;
    value: string;
    createdAt?: Date;
    updatedAt?: Date;
}

// Simplified model interfaces for now - avoiding complex Sequelize inheritance issues
export interface AdlibsModel extends AdlibsAttributes {
    update(_values: Partial<AdlibsAttributes>): Promise<AdlibsModel>;
    destroy(): Promise<void>;
}

export interface ConfigModel extends ConfigAttributes {
    update(_values: Partial<ConfigAttributes>): Promise<ConfigModel>;
    destroy(): Promise<void>;
}

export interface LoudsModel extends LoudsAttributes {
    update(_values: Partial<LoudsAttributes>): Promise<LoudsModel>;
    destroy(): Promise<void>;
}

export interface LoudsBannedModel extends LoudsBannedAttributes {
    update(_values: Partial<LoudsBannedAttributes>): Promise<LoudsBannedModel>;
    destroy(): Promise<void>;
}

export interface MemoriesModel extends MemoriesAttributes {
    update(_values: Partial<MemoriesAttributes>): Promise<MemoriesModel>;
    destroy(): Promise<void>;
}

export interface RollCallModel extends RollCallAttributes {
    update(_values: Partial<RollCallAttributes>): Promise<RollCallModel>;
    destroy(): Promise<void>;
}

export interface TwitchModel extends TwitchAttributes {
    update(_values: Partial<TwitchAttributes>): Promise<TwitchModel>;
    destroy(): Promise<void>;
}

// Static model interfaces for Sequelize model classes
export interface AdlibsModelStatic {
    findAll(_options?: unknown): Promise<AdlibsModel[]>;
    findOne(_options?: unknown): Promise<AdlibsModel | null>;
    create(_values: AdlibsAttributes): Promise<AdlibsModel>;
    findOrCreate(_options: {
        where: Partial<AdlibsAttributes>;
        defaults: AdlibsAttributes;
    }): Promise<[AdlibsModel, boolean]>;
    upsert(_values: AdlibsAttributes, _options?: unknown): Promise<[AdlibsModel, boolean]>;
    destroy(_options: unknown): Promise<number>;
    count(_options?: unknown): Promise<number>;
}

export interface ConfigModelStatic {
    findAll(_options?: unknown): Promise<ConfigModel[]>;
    findOne(_options?: unknown): Promise<ConfigModel | null>;
    create(_values: ConfigAttributes): Promise<ConfigModel>;
    findOrCreate(_options: {
        where: Partial<ConfigAttributes>;
        defaults: ConfigAttributes;
    }): Promise<[ConfigModel, boolean]>;
    upsert(_values: ConfigAttributes, _options?: unknown): Promise<[ConfigModel, boolean]>;
    destroy(_options: unknown): Promise<number>;
    count(_options?: unknown): Promise<number>;
}

export interface LoudsModelStatic {
    findAll(_options?: unknown): Promise<LoudsModel[]>;
    findOne(_options?: unknown): Promise<LoudsModel | null>;
    create(_values: LoudsAttributes): Promise<LoudsModel>;
    findOrCreate(_options: {
        where: Partial<LoudsAttributes>;
        defaults: LoudsAttributes;
    }): Promise<[LoudsModel, boolean]>;
    upsert(_values: LoudsAttributes, _options?: unknown): Promise<[LoudsModel, boolean]>;
    destroy(_options: unknown): Promise<number>;
    count(_options?: unknown): Promise<number>;
}

export interface LoudsBannedModelStatic {
    findAll(_options?: unknown): Promise<LoudsBannedModel[]>;
    findOne(_options?: unknown): Promise<LoudsBannedModel | null>;
    create(_values: LoudsBannedAttributes): Promise<LoudsBannedModel>;
    findOrCreate(_options: {
        where: Partial<LoudsBannedAttributes>;
        defaults: LoudsBannedAttributes;
    }): Promise<[LoudsBannedModel, boolean]>;
    upsert(_values: LoudsBannedAttributes, _options?: unknown): Promise<[LoudsBannedModel, boolean]>;
    destroy(_options: unknown): Promise<number>;
    count(_options?: unknown): Promise<number>;
}

export interface MemoriesModelStatic {
    findAll(_options?: unknown): Promise<MemoriesModel[]>;
    findOne(_options?: unknown): Promise<MemoriesModel | null>;
    create(_values: MemoriesAttributes): Promise<MemoriesModel>;
    findOrCreate(_options: {
        where: Partial<MemoriesAttributes>;
        defaults: MemoriesAttributes;
    }): Promise<[MemoriesModel, boolean]>;
    upsert(_values: MemoriesAttributes, _options?: unknown): Promise<[MemoriesModel, boolean]>;
    destroy(_options: unknown): Promise<number>;
    count(_options?: unknown): Promise<number>;
}

export interface RollCallModelStatic {
    findAll(_options?: unknown): Promise<RollCallModel[]>;
    findOne(_options?: unknown): Promise<RollCallModel | null>;
    create(_values: RollCallAttributes): Promise<RollCallModel>;
    findOrCreate(_options: {
        where: Partial<RollCallAttributes>;
        defaults: RollCallAttributes;
    }): Promise<[RollCallModel, boolean]>;
    upsert(_values: RollCallAttributes, _options?: unknown): Promise<[RollCallModel, boolean]>;
    destroy(_options: unknown): Promise<number>;
    count(_options?: unknown): Promise<number>;
}

export interface TwitchModelStatic {
    findAll(_options?: unknown): Promise<TwitchModel[]>;
    findOne(_options?: unknown): Promise<TwitchModel | null>;
    create(_values: TwitchAttributes): Promise<TwitchModel>;
    findOrCreate(_options: {
        where: Partial<TwitchAttributes>;
        defaults: TwitchAttributes;
    }): Promise<[TwitchModel, boolean]>;
    upsert(_values: TwitchAttributes, _options?: unknown): Promise<[TwitchModel, boolean]>;
    destroy(_options: unknown): Promise<number>;
    count(_options?: unknown): Promise<number>;
}

// Combined database tables interface
export interface DatabaseTables {
    Adlibs: AdlibsModelStatic;
    Config: ConfigModelStatic;
    Louds: LoudsModelStatic;
    Louds_Banned: LoudsBannedModelStatic;
    Memories: MemoriesModelStatic;
    RollCall: RollCallModelStatic;
    Twitch: TwitchModelStatic;
}