import axios from "axios";
import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    AutocompleteInteraction,
    EmbedBuilder,
} from "discord.js";
import { Context } from "../types";

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

function getWeatherInfo(code: number): { emoji: string; description: string } {
    return WEATHER_CODES[code] || { emoji: "❓", description: "Unknown" };
}

function formatTemperature(celsius: number, unit: string): string {
    if (unit === "fahrenheit") {
        const fahrenheit = (celsius * 9) / 5 + 32;
        return `${Math.round(fahrenheit)}°F`;
    }
    return `${Math.round(celsius)}°C`;
}

function getDayName(dateString: string): string {
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

interface GeocodingResult {
    name: string;
    latitude: number;
    longitude: number;
    country: string;
    admin1?: string;
}

interface WeatherResponse {
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

function formatLocationName(result: GeocodingResult): string {
    if (result.admin1) {
        return `${result.name}, ${result.admin1}, ${result.country}`;
    }
    return `${result.name}, ${result.country}`;
}

async function geocodeLocation(query: string): Promise<GeocodingResult | null> {
    const results = await geocodeLocationMultiple(query, 1);
    return results.length > 0 ? results[0] : null;
}

async function geocodeLocationMultiple(
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

async function getWeather(lat: number, lon: number): Promise<WeatherResponse> {
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

// Parse location value - could be "lat,lon|name" from autocomplete or plain text
function parseLocationValue(value: string): { coords?: { lat: number; lon: number; name: string }; query?: string } {
    if (value.includes("|")) {
        const [coords, name] = value.split("|");
        const [lat, lon] = coords.split(",").map(Number);
        if (!isNaN(lat) && !isNaN(lon)) {
            return { coords: { lat, lon, name } };
        }
    }
    return { query: value };
}

export default {
    data: new SlashCommandBuilder()
        .setName("weather")
        .setDescription("Get the current weather and forecast for a location")
        .addStringOption(option =>
            option
                .setName("location")
                .setDescription("City name (e.g., Canton, GA or Tokyo)")
                .setRequired(true)
                .setAutocomplete(true),
        )
        .addStringOption(option =>
            option
                .setName("unit")
                .setDescription("Temperature unit")
                .setRequired(false)
                .addChoices(
                    { name: "Celsius", value: "celsius" },
                    { name: "Fahrenheit", value: "fahrenheit" },
                ),
        ),

    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedValue = interaction.options.getFocused();

        // Need at least 2 characters to search
        if (focusedValue.length < 2) {
            await interaction.respond([]);
            return;
        }

        try {
            const results = await geocodeLocationMultiple(focusedValue, 10);

            const choices = results.map(result => {
                const name = formatLocationName(result);
                // Value format: "lat,lon|displayName" - allows us to skip geocoding later
                const value = `${result.latitude},${result.longitude}|${name}`;
                return {
                    name: name.length > 100 ? name.substring(0, 97) + "..." : name,
                    value: value.length > 100 ? value.substring(0, 100) : value,
                };
            });

            await interaction.respond(choices);
        } catch {
            await interaction.respond([]);
        }
    },

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const locationInput = interaction.options.getString("location", true);
        const unit = interaction.options.getString("unit") || "fahrenheit";

        await interaction.deferReply();

        try {
            const parsed = parseLocationValue(locationInput);
            let lat: number;
            let lon: number;
            let locationName: string;

            if (parsed.coords) {
                // From autocomplete - use coordinates directly
                lat = parsed.coords.lat;
                lon = parsed.coords.lon;
                locationName = parsed.coords.name;
            } else {
                // Manual input - geocode the location
                const geo = await geocodeLocation(parsed.query!);

                if (!geo) {
                    await interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0xff0000)
                                .setTitle("Location Not Found")
                                .setDescription(
                                    `Could not find a location matching "${parsed.query}". ` +
                                        "Try using the autocomplete suggestions.",
                                ),
                        ],
                    });
                    return;
                }

                lat = geo.latitude;
                lon = geo.longitude;
                locationName = formatLocationName(geo);
            }

            // Get weather data
            const weather = await getWeather(lat, lon);
            const current = weather.current;
            const daily = weather.daily;

            const currentWeather = getWeatherInfo(current.weather_code);

            // Build forecast string
            const forecastLines = daily.time.map((date, i) => {
                const dayWeather = getWeatherInfo(daily.weather_code[i]);
                const high = formatTemperature(daily.temperature_2m_max[i], unit);
                const low = formatTemperature(daily.temperature_2m_min[i], unit);
                return `${dayWeather.emoji} **${getDayName(date)}**: ${high} / ${low}`;
            });

            const embed = new EmbedBuilder()
                .setColor(0x5dadec)
                .setTitle(`${currentWeather.emoji} Weather in ${locationName}`)
                .setDescription(
                    `**${currentWeather.description}**\n` +
                        `Temperature: **${formatTemperature(current.temperature_2m, unit)}**\n` +
                        `Feels like: ${formatTemperature(current.apparent_temperature, unit)}\n` +
                        `Humidity: ${current.relative_humidity_2m}%\n` +
                        `Wind: ${Math.round(current.wind_speed_10m)} km/h`,
                )
                .addFields({
                    name: "5-Day Forecast",
                    value: forecastLines.join("\n"),
                })
                .setFooter({ text: "Powered by Open-Meteo" })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            context.log.info("weather command used", {
                userId: interaction.user.id,
                location: locationName,
                temperature: current.temperature_2m,
            });
        } catch (error) {
            context.log.error({ error }, "Error fetching weather data");
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle("Error")
                        .setDescription(
                            "Sorry, I could not fetch weather data at this time. " +
                                "Please try again later.",
                        ),
                ],
            });
        }
    },
};
