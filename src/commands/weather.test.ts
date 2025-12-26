import { describe, it, expect, beforeEach } from "@jest/globals";
import axios from "axios";
import weatherCommand from "./weather";

jest.mock("axios");

const mockContext = {
    log: {
        info: jest.fn(),
        error: jest.fn(),
    },
};

const createMockInteraction = (location: string, unit: string | null = null) => ({
    options: {
        getString: jest.fn().mockImplementation((name: string) => {
            if (name === "location") {
                return location;
            }
            if (name === "unit") {
                return unit;
            }
            return null;
        }),
    },
    deferReply: jest.fn().mockResolvedValue(true),
    editReply: jest.fn().mockResolvedValue(true),
    user: {
        id: "test-user-id",
        username: "testuser",
    },
});

const mockGeocodingResponse = {
    data: {
        results: [
            {
                name: "New York",
                latitude: 40.7128,
                longitude: -74.006,
                country: "United States",
                admin1: "New York",
            },
        ],
    },
};

const mockWeatherResponse = {
    data: {
        current: {
            temperature_2m: 20,
            relative_humidity_2m: 65,
            apparent_temperature: 18,
            weather_code: 0,
            wind_speed_10m: 15,
        },
        daily: {
            time: ["2025-12-26", "2025-12-27", "2025-12-28", "2025-12-29", "2025-12-30"],
            weather_code: [0, 1, 3, 61, 0],
            temperature_2m_max: [22, 21, 19, 18, 23],
            temperature_2m_min: [15, 14, 12, 10, 14],
        },
    },
};

describe("Weather Command", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("Command Data", () => {
        it("should have correct name and description", () => {
            expect(weatherCommand.data.name).toBe("weather");
            expect(weatherCommand.data.description).toContain("weather");
        });

        it("should have required location option", () => {
            const options = weatherCommand.data.options as any[];
            const locationOption = options.find((opt: any) => opt.name === "location");
            expect(locationOption).toBeDefined();
            expect(locationOption.required).toBe(true);
        });

        it("should have optional unit option", () => {
            const options = weatherCommand.data.options as any[];
            const unitOption = options.find((opt: any) => opt.name === "unit");
            expect(unitOption).toBeDefined();
            expect(unitOption.required).toBe(false);
        });
    });

    describe("Execute - Success", () => {
        it("should fetch weather and reply with embed", async () => {
            (axios.get as jest.Mock)
                .mockResolvedValueOnce(mockGeocodingResponse)
                .mockResolvedValueOnce(mockWeatherResponse);

            const mockInteraction = createMockInteraction("New York");

            await weatherCommand.execute(mockInteraction as never, mockContext as never);

            expect(mockInteraction.deferReply).toHaveBeenCalled();
            expect(axios.get).toHaveBeenCalledTimes(2);
            expect(mockInteraction.editReply).toHaveBeenCalled();

            const response = mockInteraction.editReply.mock.calls[0][0] as any;
            expect(response.embeds).toBeDefined();
            expect(response.embeds[0].data.title).toContain("New York");
        });

        it("should use Fahrenheit by default", async () => {
            (axios.get as jest.Mock)
                .mockResolvedValueOnce(mockGeocodingResponse)
                .mockResolvedValueOnce(mockWeatherResponse);

            const mockInteraction = createMockInteraction("New York");

            await weatherCommand.execute(mockInteraction as never, mockContext as never);

            const response = mockInteraction.editReply.mock.calls[0][0] as any;
            expect(response.embeds[0].data.description).toContain("°F");
        });

        it("should use Celsius when specified", async () => {
            (axios.get as jest.Mock)
                .mockResolvedValueOnce(mockGeocodingResponse)
                .mockResolvedValueOnce(mockWeatherResponse);

            const mockInteraction = createMockInteraction("New York", "celsius");

            await weatherCommand.execute(mockInteraction as never, mockContext as never);

            const response = mockInteraction.editReply.mock.calls[0][0] as any;
            expect(response.embeds[0].data.description).toContain("°C");
        });

        it("should include 5-day forecast", async () => {
            (axios.get as jest.Mock)
                .mockResolvedValueOnce(mockGeocodingResponse)
                .mockResolvedValueOnce(mockWeatherResponse);

            const mockInteraction = createMockInteraction("New York");

            await weatherCommand.execute(mockInteraction as never, mockContext as never);

            const response = mockInteraction.editReply.mock.calls[0][0] as any;
            const forecastField = response.embeds[0].data.fields.find(
                (f: any) => f.name === "5-Day Forecast",
            );
            expect(forecastField).toBeDefined();
            expect(forecastField.value).toBeTruthy();
        });

        it("should log command usage", async () => {
            (axios.get as jest.Mock)
                .mockResolvedValueOnce(mockGeocodingResponse)
                .mockResolvedValueOnce(mockWeatherResponse);

            const mockInteraction = createMockInteraction("New York");

            await weatherCommand.execute(mockInteraction as never, mockContext as never);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                "weather command used",
                expect.objectContaining({
                    userId: "test-user-id",
                }),
            );
        });
    });

    describe("Execute - Location Not Found", () => {
        it("should show error when location not found", async () => {
            (axios.get as jest.Mock).mockResolvedValueOnce({ data: { results: [] } });

            const mockInteraction = createMockInteraction("NonexistentPlace123");

            await weatherCommand.execute(mockInteraction as never, mockContext as never);

            const response = mockInteraction.editReply.mock.calls[0][0] as any;
            expect(response.embeds[0].data.title).toBe("Location Not Found");
        });

        it("should handle null results from geocoding", async () => {
            (axios.get as jest.Mock).mockResolvedValueOnce({ data: {} });

            const mockInteraction = createMockInteraction("???");

            await weatherCommand.execute(mockInteraction as never, mockContext as never);

            const response = mockInteraction.editReply.mock.calls[0][0] as any;
            expect(response.embeds[0].data.title).toBe("Location Not Found");
        });
    });

    describe("Execute - Error Handling", () => {
        it("should handle API errors gracefully", async () => {
            (axios.get as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

            const mockInteraction = createMockInteraction("New York");

            await weatherCommand.execute(mockInteraction as never, mockContext as never);

            expect(mockContext.log.error).toHaveBeenCalled();
            const response = mockInteraction.editReply.mock.calls[0][0] as any;
            expect(response.embeds[0].data.title).toBe("Error");
        });
    });

    describe("Weather Codes", () => {
        it("should display correct emoji for clear sky", async () => {
            (axios.get as jest.Mock)
                .mockResolvedValueOnce(mockGeocodingResponse)
                .mockResolvedValueOnce(mockWeatherResponse);

            const mockInteraction = createMockInteraction("New York");

            await weatherCommand.execute(mockInteraction as never, mockContext as never);

            const response = mockInteraction.editReply.mock.calls[0][0] as any;
            expect(response.embeds[0].data.title).toContain("☀️");
        });

        it("should handle various weather codes", async () => {
            const rainyWeatherResponse = {
                data: {
                    ...mockWeatherResponse.data,
                    current: {
                        ...mockWeatherResponse.data.current,
                        weather_code: 63,
                    },
                },
            };

            (axios.get as jest.Mock)
                .mockResolvedValueOnce(mockGeocodingResponse)
                .mockResolvedValueOnce(rainyWeatherResponse);

            const mockInteraction = createMockInteraction("London");

            await weatherCommand.execute(mockInteraction as never, mockContext as never);

            const response = mockInteraction.editReply.mock.calls[0][0] as any;
            expect(response.embeds[0].data.title).toContain("🌧️");
        });
    });
});
