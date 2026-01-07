import opendota from './opendota';

describe('OpenDota API', () => {
    describe('normalizeSteamId', () => {
        it('should return 32-bit ID as-is', () => {
            expect(opendota.normalizeSteamId('123456789')).toBe('123456789');
        });

        it('should convert 64-bit ID to 32-bit', () => {
            // 76561198012345678 -> 76561198012345678 - 76561197960265728 = 52079950
            expect(opendota.normalizeSteamId('76561198012345678')).toBe('52079950');
        });

        it('should trim whitespace', () => {
            expect(opendota.normalizeSteamId('  123456789  ')).toBe('123456789');
        });
    });

    describe('isSteamId64', () => {
        it('should return true for valid 64-bit Steam IDs', () => {
            expect(opendota.isSteamId64('76561198012345678')).toBe(true);
        });

        it('should return false for 32-bit Steam IDs', () => {
            expect(opendota.isSteamId64('123456789')).toBe(false);
        });

        it('should return false for short strings', () => {
            expect(opendota.isSteamId64('12345')).toBe(false);
        });
    });

    describe('convertSteamId64To32', () => {
        it('should correctly convert 64-bit to 32-bit', () => {
            // Known conversion: 76561197960265729 -> 1
            expect(opendota.convertSteamId64To32('76561197960265729')).toBe('1');
        });

        it('should handle large IDs', () => {
            // 76561198000000000 - 76561197960265728 = 39734272
            expect(opendota.convertSteamId64To32('76561198000000000')).toBe('39734272');
        });
    });
});
