import axios from "axios";

// Weather code to emoji and description mapping (WMO codes)
const WEATHER_CODES: Record<number, { emoji: string; description: string }> = {
    0: { emoji: "☀️", description: "Clear sky" },
    1: { emoji: "🌤️", description: "Mainly clear" },
    2: { emoji: "⛅", description: "Partly cloudy" },
    3: { emoji: "☁️", description: "Overcast" },
    45: { emoji: "🌫️", description: "Foggy" },
    48: { emoji: "🌫️", description: "Depositing rime fog" },
    51: { emoji: "🌧️", description: "Light drizzle" },
    53: { emoji: "🌧️", description: "Moderate drizzle" },
    55: { emoji: "🌧️", description: "Dense drizzle" },
    56: { emoji: "🌧️", description: "Light freezing drizzle" },
    57: { emoji: "🌧️", description: "Dense freezing drizzle" },
    61: { emoji: "🌧️", description: "Slight rain" },
    63: { emoji: "🌧️", description: "Moderate rain" },
    65: { emoji: "🌧️", description: "Heavy rain" },
    66: { emoji: "🌨️", description: "Light freezing rain" },
    67: { emoji: "🌨️", description: "Heavy freezing rain" },
    71: { emoji: "🌨️", description: "Slight snowfall" },
    73: { emoji: "🌨️", description: "Moderate snowfall" },
    75: { emoji: "❄️", description: "Heavy snowfall" },
    77: { emoji: "🌨️", description: "Snow grains" },
    80: { emoji: "🌦️", description: "Slight rain showers" },
    81: { emoji: "🌦️", description: "Moderate rain showers" },
    82: { emoji: "🌧️", description: "Violent rain showers" },
    85: { emoji: "🌨️", description: "Slight snow showers" },
    86: { emoji: "🌨️", description: "Heavy snow showers" },
    95: { emoji: "⛈️", description: "Thunderstorm" },
    96: { emoji: "⛈️", description: "Thunderstorm with slight hail" },
    99: { emoji: "⛈️", description: "Thunderstorm with heavy hail" },
};

export function getWeatherInfo(code: number): { emoji: string; description: string } {
    return WEATHER_CODES[code] || { emoji: "❓", description: "Unknown" };
}

export function formatTemperature(celsius: number, unit: string): string {
    if (unit === "fahrenheit") {
        const fahrenheit = (celsius * 9) / 5 + 32;
        return `${Math.round(fahrenheit)}°F`;
    }
    return `${Math.round(celsius)}°C`;
}

export function getDayName(dateString: string): string {
    const date = new Date(dateString + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.getTime() === today.getTime()) {
        return "Today";
    } else if (date.getTime() === tomorrow.getTime()) {
        return "Tomorrow";
    }
    return date.toLocaleDateString("en-US", { weekday: "short" });
}

export interface GeocodingResult {
    name: string;
    latitude: number;
    longitude: number;
    country: string;
    admin1?: string;
}

export interface WeatherResponse {
    current: {
        temperature_2m: number;
        relative_humidity_2m: number;
        apparent_temperature: number;
        weather_code: number;
        wind_speed_10m: number;
    };
    daily: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
    };
}

export function formatLocationName(result: GeocodingResult): string {
    if (result.admin1) {
        return `${result.name}, ${result.admin1}, ${result.country}`;
    }
    return `${result.name}, ${result.country}`;
}

export async function geocodeLocation(query: string): Promise<GeocodingResult | null> {
    const results = await geocodeLocationMultiple(query, 1);
    return results.length > 0 ? results[0] : null;
}

export async function geocodeLocationMultiple(
    query: string,
    count: number = 10,
): Promise<GeocodingResult[]> {
    const url = "https://geocoding-api.open-meteo.com/v1/search";
    const response = await axios.get(url, {
        params: {
            name: query,
            count,
            language: "en",
        },
    });

    if (!response.data.results || response.data.results.length === 0) {
        return [];
    }

    return response.data.results.map((result: any) => ({
        name: result.name,
        latitude: result.latitude,
        longitude: result.longitude,
        country: result.country,
        admin1: result.admin1,
    }));
}

export async function getWeather(lat: number, lon: number): Promise<WeatherResponse> {
    const url = "https://api.open-meteo.com/v1/forecast";
    const response = await axios.get(url, {
        params: {
            latitude: lat,
            longitude: lon,
            current: [
                "temperature_2m",
                "relative_humidity_2m",
                "apparent_temperature",
                "weather_code",
                "wind_speed_10m",
            ].join(","),
            daily: [
                "weather_code",
                "temperature_2m_max",
                "temperature_2m_min",
            ].join(","),
            timezone: "auto",
            forecast_days: 5,
        },
    });

    return response.data;
}
