/* eslint-disable no-unused-vars */
// Database type definitions

// Common query options for Sequelize operations
export interface WhereOptions<T> {
    [key: string]: T[keyof T] | { [key: string]: unknown } | unknown;
}

export interface FindOptions<T> {
    where?: WhereOptions<T>;
    limit?: number;
    offset?: number;
    order?: [keyof T | string, 'ASC' | 'DESC'][] | unknown;
    transaction?: unknown;
}

export interface UpsertOptions {
    returning?: boolean;
    transaction?: unknown;
}

export interface FindOrCreateOptions<T> {
    where: Partial<T>;
    defaults: T;
    transaction?: unknown;
}

export interface DestroyOptions<T> {
    where?: WhereOptions<T>;
    transaction?: unknown;
}

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

export interface MemeTemplateAttributes {
    id?: number;
    name: string;
    url: string;
    description?: string;
    // text_positions removed - now uses standardized positioning
    default_font_size: number;
    creator?: string;
    usage_count: number;
    is_active: boolean;
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

export interface MemeTemplateModel extends MemeTemplateAttributes {
    update(_values: Partial<MemeTemplateAttributes>): Promise<MemeTemplateModel>;
    destroy(): Promise<void>;
}

// Static model interfaces for Sequelize model classes
export interface AdlibsModelStatic {
    findAll(options?: FindOptions<AdlibsAttributes>): Promise<AdlibsModel[]>;
    findOne(options?: FindOptions<AdlibsAttributes>): Promise<AdlibsModel | null>;
    create(values: AdlibsAttributes): Promise<AdlibsModel>;
    findOrCreate(options: FindOrCreateOptions<AdlibsAttributes>): Promise<[AdlibsModel, boolean]>;
    upsert(values: AdlibsAttributes, options?: UpsertOptions): Promise<[AdlibsModel, boolean]>;
    destroy(options: DestroyOptions<AdlibsAttributes>): Promise<number>;
    count(options?: FindOptions<AdlibsAttributes>): Promise<number>;
}

export interface ConfigModelStatic {
    findAll(options?: FindOptions<ConfigAttributes>): Promise<ConfigModel[]>;
    findOne(options?: FindOptions<ConfigAttributes>): Promise<ConfigModel | null>;
    create(values: ConfigAttributes): Promise<ConfigModel>;
    findOrCreate(options: FindOrCreateOptions<ConfigAttributes>): Promise<[ConfigModel, boolean]>;
    upsert(values: ConfigAttributes, options?: UpsertOptions): Promise<[ConfigModel, boolean]>;
    destroy(options: DestroyOptions<ConfigAttributes>): Promise<number>;
    count(options?: FindOptions<ConfigAttributes>): Promise<number>;
}

export interface LoudsModelStatic {
    findAll(options?: FindOptions<LoudsAttributes>): Promise<LoudsModel[]>;
    findOne(options?: FindOptions<LoudsAttributes>): Promise<LoudsModel | null>;
    create(values: LoudsAttributes): Promise<LoudsModel>;
    findOrCreate(options: FindOrCreateOptions<LoudsAttributes>): Promise<[LoudsModel, boolean]>;
    upsert(values: LoudsAttributes, options?: UpsertOptions): Promise<[LoudsModel, boolean]>;
    destroy(options: DestroyOptions<LoudsAttributes>): Promise<number>;
    count(options?: FindOptions<LoudsAttributes>): Promise<number>;
}

export interface LoudsBannedModelStatic {
    findAll(options?: FindOptions<LoudsBannedAttributes>): Promise<LoudsBannedModel[]>;
    findOne(options?: FindOptions<LoudsBannedAttributes>): Promise<LoudsBannedModel | null>;
    create(values: LoudsBannedAttributes): Promise<LoudsBannedModel>;
    findOrCreate(options: FindOrCreateOptions<LoudsBannedAttributes>): Promise<[LoudsBannedModel, boolean]>;
    upsert(values: LoudsBannedAttributes, options?: UpsertOptions): Promise<[LoudsBannedModel, boolean]>;
    destroy(options: DestroyOptions<LoudsBannedAttributes>): Promise<number>;
    count(options?: FindOptions<LoudsBannedAttributes>): Promise<number>;
}

export interface MemoriesModelStatic {
    findAll(options?: FindOptions<MemoriesAttributes>): Promise<MemoriesModel[]>;
    findOne(options?: FindOptions<MemoriesAttributes>): Promise<MemoriesModel | null>;
    create(values: MemoriesAttributes): Promise<MemoriesModel>;
    findOrCreate(options: FindOrCreateOptions<MemoriesAttributes>): Promise<[MemoriesModel, boolean]>;
    upsert(values: MemoriesAttributes, options?: UpsertOptions): Promise<[MemoriesModel, boolean]>;
    destroy(options: DestroyOptions<MemoriesAttributes>): Promise<number>;
    count(options?: FindOptions<MemoriesAttributes>): Promise<number>;
}

export interface RollCallModelStatic {
    findAll(options?: FindOptions<RollCallAttributes>): Promise<RollCallModel[]>;
    findOne(options?: FindOptions<RollCallAttributes>): Promise<RollCallModel | null>;
    create(values: RollCallAttributes): Promise<RollCallModel>;
    findOrCreate(options: FindOrCreateOptions<RollCallAttributes>): Promise<[RollCallModel, boolean]>;
    upsert(values: RollCallAttributes, options?: UpsertOptions): Promise<[RollCallModel, boolean]>;
    destroy(options: DestroyOptions<RollCallAttributes>): Promise<number>;
    count(options?: FindOptions<RollCallAttributes>): Promise<number>;
}

export interface TwitchModelStatic {
    findAll(options?: FindOptions<TwitchAttributes>): Promise<TwitchModel[]>;
    findOne(options?: FindOptions<TwitchAttributes>): Promise<TwitchModel | null>;
    create(values: TwitchAttributes): Promise<TwitchModel>;
    findOrCreate(options: FindOrCreateOptions<TwitchAttributes>): Promise<[TwitchModel, boolean]>;
    upsert(values: TwitchAttributes, options?: UpsertOptions): Promise<[TwitchModel, boolean]>;
    destroy(options: DestroyOptions<TwitchAttributes>): Promise<number>;
    count(options?: FindOptions<TwitchAttributes>): Promise<number>;
}

export interface MemeTemplateModelStatic {
    findAll(options?: FindOptions<MemeTemplateAttributes>): Promise<MemeTemplateModel[]>;
    findOne(options?: FindOptions<MemeTemplateAttributes>): Promise<MemeTemplateModel | null>;
    create(values: MemeTemplateAttributes): Promise<MemeTemplateModel>;
    findOrCreate(options: FindOrCreateOptions<MemeTemplateAttributes>): Promise<[MemeTemplateModel, boolean]>;
    upsert(values: MemeTemplateAttributes, options?: UpsertOptions): Promise<[MemeTemplateModel, boolean]>;
    destroy(options: DestroyOptions<MemeTemplateAttributes>): Promise<number>;
    count(options?: FindOptions<MemeTemplateAttributes>): Promise<number>;
    findAndCountAll(options?: FindOptions<MemeTemplateAttributes> & { limit?: number; offset?: number; })
        : Promise<{ count: number; rows: MemeTemplateModel[] }>;
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
    MemeTemplate: MemeTemplateModelStatic;
    [key: string]: any; // Allow dynamic table access
}