import axios from "axios";
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import drinkCommand, { activeGames } from "./drink";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any, no-unused-vars
type MockImplementation = (...args: any[]) => Promise<any>;

const mockCollector = {
    on: jest.fn<any>(),
};

const mockMessage = {
    id: "test-message-id",
    createMessageComponentCollector: jest.fn<any>().mockReturnValue(mockCollector),
    edit: jest.fn<any>(),
};

describe("commands/drink", () => {
    let mockInteraction: any;
    let mockContext: any;

    const mockDrink = {
        idDrink: "12345",
        strDrink: "Margarita",
        strDrinkThumb: "https://example.com/margarita.jpg",
        strInstructions: "Shake well and serve",
        strGlass: "Cocktail glass",
        strCategory: "Cocktail",
        strAlcoholic: "Alcoholic",
        strIngredient1: "Tequila",
        strIngredient2: "Triple sec",
        strIngredient3: "Lime juice",
        strIngredient4: null,
        strIngredient5: null,
        strIngredient6: null,
        strIngredient7: null,
        strIngredient8: null,
        strIngredient9: null,
        strIngredient10: null,
        strIngredient11: null,
        strIngredient12: null,
        strIngredient13: null,
        strIngredient14: null,
        strIngredient15: null,
        strMeasure1: "2 oz",
        strMeasure2: "1 oz",
        strMeasure3: "1 oz",
        strMeasure4: null,
        strMeasure5: null,
        strMeasure6: null,
        strMeasure7: null,
        strMeasure8: null,
        strMeasure9: null,
        strMeasure10: null,
        strMeasure11: null,
        strMeasure12: null,
        strMeasure13: null,
        strMeasure14: null,
        strMeasure15: null,
    };

    const createMockDrinks = () => [
        mockDrink,
        { ...mockDrink, idDrink: "2", strDrink: "Mojito" },
        { ...mockDrink, idDrink: "3", strDrink: "Daiquiri" },
        { ...mockDrink, idDrink: "4", strDrink: "Cosmopolitan" },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        activeGames.clear();

        mockInteraction = {
            user: { id: "test-user-id" },
            channelId: "test-channel-id",
            deferReply: jest.fn<any>().mockImplementation(async () => {
                mockInteraction.deferred = true;
            }),
            editReply: jest.fn<any>().mockResolvedValue(mockMessage),
            reply: jest.fn<any>().mockResolvedValue(undefined),
            deferred: false,
        };

        mockContext = {
            log: {
                info: jest.fn<any>(),
                error: jest.fn<any>(),
                debug: jest.fn<any>(),
                warn: jest.fn<any>(),
            },
        };
    });

    afterEach(() => {
        activeGames?.clear();
    });

    describe("command data", () => {
        it("should have correct name and description", () => {
            expect(drinkCommand.data.name).toBe("drink");
            expect(drinkCommand.data.description).toContain("cocktail");
        });
    });

    describe("execute", () => {
        it("should defer reply before fetching", async () => {
            const drinks = createMockDrinks();
            let callCount = 0;
            (mockedAxios.get as jest.Mock).mockImplementation((async () => ({
                data: { drinks: [drinks[callCount++]] },
            })) as MockImplementation);

            await drinkCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.deferReply).toHaveBeenCalled();
        });

        it("should fetch 4 random cocktails from the API", async () => {
            const drinks = createMockDrinks();
            let callCount = 0;
            (mockedAxios.get as jest.Mock).mockImplementation((async () => ({
                data: { drinks: [drinks[callCount++]] },
            })) as MockImplementation);

            await drinkCommand.execute(mockInteraction, mockContext);

            expect(mockedAxios.get).toHaveBeenCalledWith(
                "https://www.thecocktaildb.com/api/json/v1/1/random.php",
                { headers: { "User-Agent": "Alia Discord Bot" } },
            );
            expect(mockedAxios.get).toHaveBeenCalledTimes(4);
        });

        it("should respond with an embed containing drink details and buttons", async () => {
            const drinks = createMockDrinks();
            let callCount = 0;
            (mockedAxios.get as jest.Mock).mockImplementation((async () => ({
                data: { drinks: [drinks[callCount++]] },
            })) as MockImplementation);

            await drinkCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                embeds: [
                    expect.objectContaining({
                        data: expect.objectContaining({
                            title: expect.stringContaining("Guess the Cocktail"),
                            image: expect.objectContaining({
                                url: mockDrink.strDrinkThumb,
                            }),
                        }),
                    }),
                ],
                components: expect.arrayContaining([
                    expect.objectContaining({
                        components: expect.arrayContaining([
                            expect.objectContaining({
                                data: expect.objectContaining({
                                    label: "A",
                                }),
                            }),
                        ]),
                    }),
                ]),
            });
        });

        it("should include 4 answer buttons", async () => {
            const drinks = createMockDrinks();
            let callCount = 0;
            (mockedAxios.get as jest.Mock).mockImplementation((async () => ({
                data: { drinks: [drinks[callCount++]] },
            })) as MockImplementation);

            await drinkCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.editReply.mock.calls[0][0];
            const actionRow = response.components[0];
            expect(actionRow.components).toHaveLength(4);
            expect(actionRow.components[0].data.label).toBe("A");
            expect(actionRow.components[1].data.label).toBe("B");
            expect(actionRow.components[2].data.label).toBe("C");
            expect(actionRow.components[3].data.label).toBe("D");
        });

        it("should include ingredients in the embed", async () => {
            const drinks = createMockDrinks();
            let callCount = 0;
            (mockedAxios.get as jest.Mock).mockImplementation((async () => ({
                data: { drinks: [drinks[callCount++]] },
            })) as MockImplementation);

            await drinkCommand.execute(mockInteraction, mockContext);

            const embedCall = mockInteraction.editReply.mock.calls[0][0];
            const embed = embedCall.embeds[0];
            const ingredientsField = embed.data.fields.find(
                (f: any) => f.name === "📋 Ingredients",
            );

            expect(ingredientsField).toBeDefined();
            expect(ingredientsField.value).toContain("Tequila");
        });

        it("should include time field", async () => {
            const drinks = createMockDrinks();
            let callCount = 0;
            (mockedAxios.get as jest.Mock).mockImplementation((async () => ({
                data: { drinks: [drinks[callCount++]] },
            })) as MockImplementation);

            await drinkCommand.execute(mockInteraction, mockContext);

            const embedCall = mockInteraction.editReply.mock.calls[0][0];
            const embed = embedCall.embeds[0];
            const timeField = embed.data.fields.find(
                (f: any) => f.name === "⏱️ Time",
            );

            expect(timeField).toBeDefined();
            expect(timeField.value).toContain("30 seconds");
        });

        it("should log game started", async () => {
            const drinks = createMockDrinks();
            let callCount = 0;
            (mockedAxios.get as jest.Mock).mockImplementation((async () => ({
                data: { drinks: [drinks[callCount++]] },
            })) as MockImplementation);

            await drinkCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                "drink game started",
                expect.objectContaining({
                    drinkId: "12345",
                    drinkName: "Margarita",
                    userId: "test-user-id",
                    gameId: expect.any(String),
                    channelId: "test-channel-id",
                }),
            );
        });

        it("should add game to active games map", async () => {
            const drinks = createMockDrinks();
            let callCount = 0;
            (mockedAxios.get as jest.Mock).mockImplementation((async () => ({
                data: { drinks: [drinks[callCount++]] },
            })) as MockImplementation);

            await drinkCommand.execute(mockInteraction, mockContext);

            expect(activeGames.has("test-channel-id")).toBe(true);
        });

        it("should reject if game already active in channel", async () => {
            const drinks = createMockDrinks();
            let callCount = 0;
            (mockedAxios.get as jest.Mock).mockImplementation((async () => ({
                data: { drinks: [drinks[callCount++ % 4]] },
            })) as MockImplementation);

            // First game
            await drinkCommand.execute(mockInteraction, mockContext);

            // Second game should be rejected
            const secondInteraction = {
                ...mockInteraction,
                reply: jest.fn<any>(),
            };
            await drinkCommand.execute(secondInteraction, mockContext);

            expect(secondInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining("already a drink guessing game"),
                ephemeral: true,
            });
        });

        it("should handle not enough drinks fetched", async () => {
            mockedAxios.get.mockResolvedValue({
                data: { drinks: [mockDrink] },
            });

            await drinkCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                expect.stringContaining("Could not fetch enough drinks"),
            );
        });

        it("should handle API errors gracefully", async () => {
            mockedAxios.get.mockRejectedValue(new Error("Network error"));

            await drinkCommand.execute(mockInteraction, mockContext);

            // When API fails, it gracefully returns a "not enough drinks" message
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                expect.stringContaining("Could not fetch enough drinks"),
            );
        });

        it("should create message collector", async () => {
            const drinks = createMockDrinks();
            let callCount = 0;
            (mockedAxios.get as jest.Mock).mockImplementation((async () => ({
                data: { drinks: [drinks[callCount++]] },
            })) as MockImplementation);

            await drinkCommand.execute(mockInteraction, mockContext);

            expect(mockMessage.createMessageComponentCollector).toHaveBeenCalledWith({
                componentType: 2,
                time: 30000,
            });
        });

        it("should register collect and end handlers", async () => {
            const drinks = createMockDrinks();
            let callCount = 0;
            (mockedAxios.get as jest.Mock).mockImplementation((async () => ({
                data: { drinks: [drinks[callCount++]] },
            })) as MockImplementation);

            await drinkCommand.execute(mockInteraction, mockContext);

            expect(mockCollector.on).toHaveBeenCalledWith('collect', expect.any(Function));
            expect(mockCollector.on).toHaveBeenCalledWith('end', expect.any(Function));
        });
    });
});
