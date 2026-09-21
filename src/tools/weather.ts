import { geocodeLocation, getWeather, getWeatherInfo } from '../lib/weather-core';
import { Tool, ToolAnswer, ToolContext } from './types';

/**
 * Pulls a place out of the question. Without a place there is nothing to look
 * up, and guessing a default would answer confidently about the wrong city.
 */
export function extractLocation(query: string): string | null {
    const match = /\b(?:in|at|for)\s+([A-Za-z][A-Za-z\s.'-]{1,40})/i.exec(query);
    if (!match) {
        return null;
    }
    const place = match[1]
        .replace(/\b(today|tomorrow|tonight|now|right now|this week)\b/gi, '')
        .replace(/[?!.]+$/, '')
        .trim();
    return place.length >= 2 ? place : null;
}

export const weatherTool: Tool = {
    name: 'weather',

    async run(
        query: string,
        _ctx: ToolContext,
        deps: { fetch?: typeof fetch } = {},
    ): Promise<ToolAnswer | null> {
        const place = extractLocation(query);
        if (!place) {
            return null;
        }

        try {
            const location = await geocodeLocation(place, deps);
            if (!location) {
                return null;
            }

            const weather = await getWeather(location.latitude, location.longitude, deps);
            const current = weather?.current;
            if (!current) {
                return null;
            }

            const info = getWeatherInfo(current.weather_code);
            return {
                title: `${info.emoji} ${location.name}, ${location.country}`,
                body: `${Math.round(current.temperature_2m)}°C, ${info.description}.`,
                sourceLabel: 'open-meteo',
            };
        } catch {
            return null;
        }
    },
};
