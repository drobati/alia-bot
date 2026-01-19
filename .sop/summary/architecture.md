# System Architecture

## High-Level Architecture

Alia-bot follows an **event-driven architecture** built on Discord.js with three primary execution paths: slash commands, message responses, and event handlers.

```mermaid
graph TB
    subgraph "Discord Gateway"
        DG[Discord API]
    end

    subgraph "Bot Core"
        C[Discord Client]
        EL[Event Listeners]
        CH[Command Handler]
        RH[Response Handler]
    end

    subgraph "Processing Layer"
        CMD[Slash Commands]
        RSP[Message Responses]
        SVC[Services]
    end

    subgraph "Data Layer"
        DB[(MySQL Database)]
        CACHE[In-Memory Cache]
    end

    subgraph "External Services"
        OAI[OpenAI API]
        TW[Twitch API]
        POLY[Polygon.io API]
        MF[Metaforge API]
        SENTRY[Sentry.io]
    end

    DG <--> C
    C --> EL
    EL --> CH
    EL --> RH
    CH --> CMD
    RH --> RSP
    CMD --> SVC
    RSP --> SVC
    SVC --> DB
    SVC --> CACHE
    SVC --> OAI
    SVC --> TW
    SVC --> POLY
    SVC --> MF
    SVC --> SENTRY
```

## Application Layers

### Layer 1: Entry Point (`index.ts`)

The main entry point initializes the Discord client, connects to the database, and sets up the shared Context object.

```mermaid
flowchart TD
    START[Application Start] --> ENV[Load Environment]
    ENV --> SENTRY[Initialize Sentry]
    SENTRY --> CLIENT[Create Discord Client]
    CLIENT --> DB[Connect Database]
    DB --> MODELS[Load Models]
    MODELS --> CMDS[Load Commands]
    CMDS --> EVENTS[Load Events]
    EVENTS --> LOGIN[Discord Login]
    LOGIN --> READY[Bot Ready]
```

**Key Responsibilities:**
- Discord client initialization with required intents
- Sequelize database connection and sync
- Dynamic loading of commands and events
- Creation of shared Context object
- Global error handlers (uncaughtException, unhandledRejection)
- Graceful shutdown handling (SIGINT, SIGTERM)

### Layer 2: Event Handlers (`events/`)

Discord.js events are routed to corresponding handler files.

```mermaid
graph LR
    subgraph "Discord Events"
        E1[ready]
        E2[messageCreate]
        E3[interactionCreate]
        E4[guildMemberAdd]
        E5[voiceStateUpdate]
    end

    subgraph "Event Handlers"
        H1[ready.ts]
        H2[messageCreate.ts]
        H3[interactionCreate.ts]
        H4[guildMemberAdd.ts]
        H5[voiceStateUpdate.ts]
    end

    E1 --> H1
    E2 --> H2
    E3 --> H3
    E4 --> H4
    E5 --> H5
```

### Layer 3: Command System (`src/commands/`)

Slash commands are registered with Discord and executed via interactionCreate events.

```mermaid
sequenceDiagram
    participant U as User
    participant D as Discord
    participant B as Bot
    participant H as Handler
    participant S as Service
    participant DB as Database

    U->>D: /command [options]
    D->>B: Interaction Event
    B->>H: Route to Command
    H->>S: Execute Logic
    S->>DB: Query/Update
    DB-->>S: Result
    S-->>H: Response Data
    H-->>B: Reply Object
    B-->>D: Send Reply
    D-->>U: Display Response
```

### Layer 4: Response System (`src/responses/`)

Message responses are processed through a priority-based chain.

```mermaid
flowchart TD
    MSG[Message Received] --> V{Verification?}
    V -->|Yes| VR[Verification Response]
    V -->|No| DND{D&D Game?}
    DND -->|Yes| DR[D&D Response]
    DND -->|No| AST{Assistant Match?}
    AST -->|Yes| AR[OpenAI Response]
    AST -->|No| TRG{Trigger Match?}
    TRG -->|Yes| TR[Trigger Response]
    TRG -->|No| ADL{Adlib Match?}
    ADL -->|Yes| ALR[Adlib Response]
    ADL -->|No| LUD{Loud Match?}
    LUD -->|Yes| LR[Loud Response]
    LUD -->|No| END[No Response]
```

## Design Patterns

### 1. Context Pattern

A shared `Context` object is passed through all handlers, providing access to:

```typescript
interface Context {
    tables: {          // Sequelize models
        Adlibs: Model;
        Config: Model;
        Louds: Model;
        // ... 21 models total
    };
    log: BunyanLogger;      // Structured logging
    sequelize: Sequelize;   // Database connection
    VERSION: string;        // Bot version
    voiceService: VoiceService;
    motivationalScheduler: MotivationalScheduler;
    sparksService: SparksService;
}
```

### 2. Event-Driven Architecture

Discord events trigger file-based handlers automatically:

```mermaid
classDiagram
    class BotEvent {
        +string name
        +boolean once
        +execute(...args, context)
    }

    class BotCommand {
        +SlashCommandBuilder data
        +execute(interaction, context)
        +autocomplete?(interaction, context)
    }

    BotEvent <|-- ReadyEvent
    BotEvent <|-- MessageCreateEvent
    BotEvent <|-- InteractionCreateEvent

    BotCommand <|-- ArcCommand
    BotCommand <|-- MemeCommand
    BotCommand <|-- PollCommand
```

### 3. Factory Pattern for Models

Database models are initialized through factory functions:

```typescript
// Model Factory Pattern
export default function(sequelize: Sequelize): ModelCtor<Model> {
    return sequelize.define('ModelName', schema, options);
}
```

### 4. Singleton Services

Services are instantiated once at startup and shared:

```mermaid
graph TB
    INIT[Bot Initialization] --> VS[VoiceService Instance]
    INIT --> MS[MotivationalScheduler Instance]
    INIT --> SS[SparksService Instance]

    VS --> CTX[Context Object]
    MS --> CTX
    SS --> CTX

    CTX --> CMD[Commands]
    CTX --> RSP[Responses]
    CTX --> EVT[Events]
```

### 5. Priority Chain Pattern

Message responses use a priority chain where first match wins:

```typescript
const responsePriority = [
    { name: 'verification', handler: verificationResponse },
    { name: 'dnd', handler: dndResponse },
    { name: 'assistant', handler: assistantResponse },  // OpenAI
    { name: 'triggers', handler: triggerResponse },
    { name: 'adlibs', handler: adlibsResponse },
    { name: 'louds', handler: loudsResponse },
];
```

## Module Architecture

### Command Module Structure

```
src/commands/
├── arc.ts              # Arc Raiders integration
├── meme.ts             # Meme generation
├── poll.ts             # Interactive polls
├── dnd.ts              # D&D game system
├── speak.ts            # Voice TTS
└── ...                 # 51 commands total
```

Each command exports:
```typescript
export const data = new SlashCommandBuilder()
    .setName('command-name')
    .setDescription('Command description');

export async function execute(
    interaction: ChatInputCommandInteraction,
    context: Context
): Promise<void>;

export async function autocomplete?(
    interaction: AutocompleteInteraction,
    context: Context
): Promise<void>;
```

### Service Module Structure

```mermaid
classDiagram
    class VoiceService {
        -Map connections
        +joinChannel(channel, guild)
        +leaveChannel(guild)
        +speak(text, voice, guild)
    }

    class MotivationalScheduler {
        -Map jobs
        +start(context)
        +stop()
        +scheduleGuild(guildId, config)
    }

    class SparksService {
        +createUser(userId)
        +getBalance(userId)
        +addSparks(userId, amount)
        +transfer(from, to, amount)
    }

    class SchedulerService {
        -Map scheduledEvents
        +scheduleEvent(event)
        +cancelEvent(eventId)
    }
```

## Data Flow

### Command Execution Flow

```mermaid
sequenceDiagram
    participant User
    participant Discord
    participant InteractionCreate
    participant CommandHandler
    participant Service
    participant Database
    participant ExternalAPI

    User->>Discord: /arc search rifle
    Discord->>InteractionCreate: Interaction Event
    InteractionCreate->>CommandHandler: Route to arc.ts
    CommandHandler->>Service: searchItems("rifle")
    Service->>ExternalAPI: Metaforge API Call
    ExternalAPI-->>Service: Item Data
    Service->>Database: Check Wishlist
    Database-->>Service: Wishlist Status
    Service-->>CommandHandler: Formatted Response
    CommandHandler-->>InteractionCreate: Embed Reply
    InteractionCreate-->>Discord: Send Message
    Discord-->>User: Display Results
```

### NLP Response Flow

```mermaid
sequenceDiagram
    participant User
    participant MessageCreate
    participant HybridClassifier
    participant OpenAI
    participant ThreadManager

    User->>MessageCreate: "What's the weather like?"
    MessageCreate->>HybridClassifier: Classify Intent
    HybridClassifier->>HybridClassifier: Bayesian Classification
    HybridClassifier-->>MessageCreate: {intent: "general-knowledge", confidence: 0.85}
    MessageCreate->>ThreadManager: Get/Create Thread
    ThreadManager-->>MessageCreate: Thread ID
    MessageCreate->>OpenAI: Send Message to Thread
    OpenAI-->>MessageCreate: AI Response
    MessageCreate-->>User: Reply with Response
```

## Error Handling Architecture

```mermaid
flowchart TD
    ERR[Error Occurs] --> TYPE{Error Type?}

    TYPE -->|Uncaught Exception| UE[Process Handler]
    TYPE -->|Unhandled Rejection| UR[Process Handler]
    TYPE -->|Command Error| CE[Command Handler]
    TYPE -->|Response Error| RE[Response Handler]

    UE --> SENTRY[Sentry Capture]
    UR --> SENTRY
    CE --> SENTRY
    RE --> SENTRY

    SENTRY --> LOG[Bunyan Log]
    LOG --> CTX[Add Context]
    CTX --> NOTIFY[Optional User Notify]

    UE --> SHUTDOWN[Graceful Shutdown]
    UR --> CONTINUE[Continue Running]
    CE --> REPLY[Error Reply]
    RE --> SILENT[Silent Failure]
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "GitHub"
        REPO[Repository]
        ACTIONS[GitHub Actions]
    end

    subgraph "AWS"
        ECR[ECR Registry]
        ECS[ECS Cluster]
        TASK[ECS Task]
        SECRETS[Secrets Manager]
        RDS[(RDS MySQL)]
    end

    subgraph "External"
        DISCORD[Discord API]
        SENTRY[Sentry.io]
    end

    REPO --> ACTIONS
    ACTIONS -->|Build & Push| ECR
    ECR -->|Deploy| ECS
    ECS --> TASK
    TASK --> SECRETS
    TASK --> RDS
    TASK --> DISCORD
    TASK --> SENTRY
```

## Security Architecture

```mermaid
flowchart LR
    subgraph "Authentication"
        BOT_TOKEN[Bot Token]
        API_KEYS[API Keys]
    end

    subgraph "Authorization"
        OWNER[Owner Check]
        PERMS[Discord Perms]
    end

    subgraph "Storage"
        ENV[Environment Vars]
        SECRETS[AWS Secrets]
        CONFIG[YAML Config]
    end

    BOT_TOKEN --> ENV
    API_KEYS --> SECRETS
    OWNER --> CONFIG
    PERMS --> DISCORD[Discord API]
```
