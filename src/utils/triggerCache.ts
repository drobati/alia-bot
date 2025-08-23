interface TriggerCacheEntry {
    key: string;
    value: string;
}

class TriggerCache {
    private triggers: TriggerCacheEntry[] = [];
    private isLoaded = false;

    async loadTriggers(memoriesModel: any): Promise<void> {
        const triggeredMemories = await memoriesModel.findAll({
            where: {
                triggered: true,
            },
            raw: true,
        });

        this.triggers = triggeredMemories.map((memory: any) => ({
            key: memory.key.toLowerCase(),
            value: memory.value,
        }));

        this.isLoaded = true;
    }

    getTriggers(): TriggerCacheEntry[] {
        return this.triggers;
    }

    isReady(): boolean {
        return this.isLoaded;
    }

    invalidateCache(): void {
        this.isLoaded = false;
        this.triggers = [];
    }

    addTrigger(key: string, value: string): void {
        const normalizedKey = key.toLowerCase();

        // Remove existing trigger with same key
        this.triggers = this.triggers.filter(t => t.key !== normalizedKey);

        // Add new trigger
        this.triggers.push({
            key: normalizedKey,
            value,
        });
    }

    removeTrigger(key: string): void {
        const normalizedKey = key.toLowerCase();
        this.triggers = this.triggers.filter(t => t.key !== normalizedKey);
    }

    updateTriggerStatus(key: string, triggered: boolean, value: string): void {
        const normalizedKey = key.toLowerCase();

        if (triggered) {
            this.addTrigger(normalizedKey, value);
        } else {
            this.removeTrigger(normalizedKey);
        }
    }
}

export const triggerCache = new TriggerCache();