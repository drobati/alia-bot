import { Model, DataTypes } from 'sequelize';

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

// Model class interfaces
export interface AdlibsModel extends Model<AdlibsAttributes>, AdlibsAttributes {
    update(values: Partial<AdlibsAttributes>): Promise<this>;
    destroy(): Promise<void>;
}

export interface ConfigModel extends Model<ConfigAttributes>, ConfigAttributes {
    update(values: Partial<ConfigAttributes>): Promise<ConfigModel>;
    destroy(): Promise<void>;
}

export interface LoudsModel extends Model<LoudsAttributes>, LoudsAttributes {
    update(values: Partial<LoudsAttributes>): Promise<LoudsModel>;
    destroy(): Promise<void>;
}

export interface LoudsBannedModel extends Model<LoudsBannedAttributes>, LoudsBannedAttributes {
    update(values: Partial<LoudsBannedAttributes>): Promise<LoudsBannedModel>;
    destroy(): Promise<void>;
}

export interface MemoriesModel extends Model<MemoriesAttributes>, MemoriesAttributes {
    update(values: Partial<MemoriesAttributes>): Promise<MemoriesModel>;
    destroy(): Promise<void>;
}

export interface RollCallModel extends Model<RollCallAttributes>, RollCallAttributes {
    update(values: Partial<RollCallAttributes>): Promise<RollCallModel>;
    destroy(): Promise<void>;
}

export interface TwitchModel extends Model<TwitchAttributes>, TwitchAttributes {
    update(values: Partial<TwitchAttributes>): Promise<TwitchModel>;
    destroy(): Promise<void>;
}

// Static model interfaces for Sequelize model classes
export interface AdlibsModelStatic {
    findAll(options?: any): Promise<AdlibsModel[]>;
    findOne(options?: any): Promise<AdlibsModel | null>;
    create(values: AdlibsAttributes): Promise<AdlibsModel>;
    findOrCreate(options: { where: Partial<AdlibsAttributes>; defaults: AdlibsAttributes }): Promise<[AdlibsModel, boolean]>;
    upsert(values: AdlibsAttributes, options?: any): Promise<[AdlibsModel, boolean]>;
    destroy(options: any): Promise<number>;
    count(options?: any): Promise<number>;
}

export interface ConfigModelStatic {
    findAll(options?: any): Promise<ConfigModel[]>;
    findOne(options?: any): Promise<ConfigModel | null>;
    create(values: ConfigAttributes): Promise<ConfigModel>;
    findOrCreate(options: { where: Partial<ConfigAttributes>; defaults: ConfigAttributes }): Promise<[ConfigModel, boolean]>;
    upsert(values: ConfigAttributes, options?: any): Promise<[ConfigModel, boolean]>;
    destroy(options: any): Promise<number>;
    count(options?: any): Promise<number>;
}

export interface LoudsModelStatic {
    findAll(options?: any): Promise<LoudsModel[]>;
    findOne(options?: any): Promise<LoudsModel | null>;
    create(values: LoudsAttributes): Promise<LoudsModel>;
    findOrCreate(options: { where: Partial<LoudsAttributes>; defaults: LoudsAttributes }): Promise<[LoudsModel, boolean]>;
    upsert(values: LoudsAttributes, options?: any): Promise<[LoudsModel, boolean]>;
    destroy(options: any): Promise<number>;
    count(options?: any): Promise<number>;
}

export interface LoudsBannedModelStatic {
    findAll(options?: any): Promise<LoudsBannedModel[]>;
    findOne(options?: any): Promise<LoudsBannedModel | null>;
    create(values: LoudsBannedAttributes): Promise<LoudsBannedModel>;
    findOrCreate(options: { where: Partial<LoudsBannedAttributes>; defaults: LoudsBannedAttributes }): Promise<[LoudsBannedModel, boolean]>;
    upsert(values: LoudsBannedAttributes, options?: any): Promise<[LoudsBannedModel, boolean]>;
    destroy(options: any): Promise<number>;
    count(options?: any): Promise<number>;
}

export interface MemoriesModelStatic {
    findAll(options?: any): Promise<MemoriesModel[]>;
    findOne(options?: any): Promise<MemoriesModel | null>;
    create(values: MemoriesAttributes): Promise<MemoriesModel>;
    findOrCreate(options: { where: Partial<MemoriesAttributes>; defaults: MemoriesAttributes }): Promise<[MemoriesModel, boolean]>;
    upsert(values: MemoriesAttributes, options?: any): Promise<[MemoriesModel, boolean]>;
    destroy(options: any): Promise<number>;
    count(options?: any): Promise<number>;
}

export interface RollCallModelStatic {
    findAll(options?: any): Promise<RollCallModel[]>;
    findOne(options?: any): Promise<RollCallModel | null>;
    create(values: RollCallAttributes): Promise<RollCallModel>;
    findOrCreate(options: { where: Partial<RollCallAttributes>; defaults: RollCallAttributes }): Promise<[RollCallModel, boolean]>;
    upsert(values: RollCallAttributes, options?: any): Promise<[RollCallModel, boolean]>;
    destroy(options: any): Promise<number>;
    count(options?: any): Promise<number>;
}

export interface TwitchModelStatic {
    findAll(options?: any): Promise<TwitchModel[]>;
    findOne(options?: any): Promise<TwitchModel | null>;
    create(values: TwitchAttributes): Promise<TwitchModel>;
    findOrCreate(options: { where: Partial<TwitchAttributes>; defaults: TwitchAttributes }): Promise<[TwitchModel, boolean]>;
    upsert(values: TwitchAttributes, options?: any): Promise<[TwitchModel, boolean]>;
    destroy(options: any): Promise<number>;
    count(options?: any): Promise<number>;
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