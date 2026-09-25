import { weatherTool } from './weather';
import { createContext } from '../utils/testHelpers';

jest.mock('../lib/weather-core', () => ({
    ...jest.requireActual('../lib/weather-core'),
    geocodeLocation: jest.fn(),
    getWeather: jest.fn(),
}));

import { geocodeLocation, getWeather } from '../lib/weather-core';

const ctx = () => ({ message: {} as never, context: createContext() as never });

describe('weatherTool', () => {
    beforeEach(() => jest.clearAllMocks());

    it('answers with the current conditions for the named place', async () => {
        (geocodeLocation as jest.Mock).mockResolvedValue({
            name: 'Tokyo', country: 'Japan', latitude: 35.6, longitude: 139.6,
        });
        (getWeather as jest.Mock).mockResolvedValue({
            current: { temperature_2m: 18.2, weather_code: 3 },
        });

        const answer = await weatherTool.run('is it gonna rain in tokyo tomorrow?', ctx());

        expect(answer?.sourceLabel).toBe('open-meteo');
        expect(answer?.title).toContain('Tokyo');
        expect(answer?.body).toContain('18');
    });

    it('returns null when the place cannot be geocoded', async () => {
        (geocodeLocation as jest.Mock).mockResolvedValue(null);
        expect(await weatherTool.run('weather in asdfqwer?', ctx())).toBeNull();
    });

    it('returns null when no place is named at all', async () => {
        expect(await weatherTool.run('is it gonna rain tomorrow?', ctx())).toBeNull();
        expect(geocodeLocation).not.toHaveBeenCalled();
    });

    it('returns null when the forecast lookup throws', async () => {
        (geocodeLocation as jest.Mock).mockResolvedValue({
            name: 'Tokyo', country: 'Japan', latitude: 35.6, longitude: 139.6,
        });
        (getWeather as jest.Mock).mockRejectedValue(new Error('down'));
        expect(await weatherTool.run('weather in tokyo?', ctx())).toBeNull();
    });
});
