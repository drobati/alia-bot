import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    AutocompleteInteraction,
    EmbedBuilder,
} from "discord.js";
import { Context } from "../types";
import {
    formatLocationName,
    formatTemperature,
    geocodeLocation,
    geocodeLocationMultiple,
    getDayName,
    getWeather,
    getWeatherInfo,
} from "../lib/weather-core";

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
