import axios from "axios";
import drinkCommand from "./drink";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("commands/drink", () => {
    let mockInteraction: any;
    let mockContext: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockInteraction = {
            user: { id: "test-user-id" },
            deferReply: jest.fn().mockImplementation(async () => {
                mockInteraction.deferred = true;
            }),
            editReply: jest.fn().mockResolvedValue(undefined),
            reply: jest.fn().mockResolvedValue(undefined),
            deferred: false,
        };

        mockContext = {
            log: {
                info: jest.fn(),
                error: jest.fn(),
                debug: jest.fn(),
                warn: jest.fn(),
            },
        };
    });

    describe("command data", () => {
        it("should have correct name and description", () => {
            expect(drinkCommand.data.name).toBe("drink");
            expect(drinkCommand.data.description).toContain("cocktail");
        });
    });

    describe("execute", () => {
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

        it("should defer reply before fetching", async () => {
            mockedAxios.get.mockResolvedValue({
                data: { drinks: [mockDrink] },
            });

            await drinkCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.deferReply).toHaveBeenCalled();
        });

        it("should fetch a random cocktail from the API", async () => {
            mockedAxios.get.mockResolvedValue({
                data: { drinks: [mockDrink] },
            });

            await drinkCommand.execute(mockInteraction, mockContext);

            expect(mockedAxios.get).toHaveBeenCalledWith(
                "https://www.thecocktaildb.com/api/json/v1/1/random.php",
                { headers: { "User-Agent": "Alia Discord Bot" } }
            );
        });

        it("should respond with an embed containing drink details", async () => {
            mockedAxios.get.mockResolvedValue({
                data: { drinks: [mockDrink] },
            });

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
            });
        });

        it("should include ingredients in the embed", async () => {
            mockedAxios.get.mockResolvedValue({
                data: { drinks: [mockDrink] },
            });

            await drinkCommand.execute(mockInteraction, mockContext);

            const embedCall = mockInteraction.editReply.mock.calls[0][0];
            const embed = embedCall.embeds[0];
            const ingredientsField = embed.data.fields.find(
                (f: any) => f.name === "📋 Ingredients"
            );

            expect(ingredientsField).toBeDefined();
            expect(ingredientsField.value).toContain("Tequila");
            expect(ingredientsField.value).toContain("Triple sec");
            expect(ingredientsField.value).toContain("Lime juice");
        });

        it("should include the answer as a spoiler", async () => {
            mockedAxios.get.mockResolvedValue({
                data: { drinks: [mockDrink] },
            });

            await drinkCommand.execute(mockInteraction, mockContext);

            const embedCall = mockInteraction.editReply.mock.calls[0][0];
            const embed = embedCall.embeds[0];
            const answerField = embed.data.fields.find(
                (f: any) => f.name === "🎯 Answer"
            );

            expect(answerField).toBeDefined();
            expect(answerField.value).toBe("||Margarita||");
        });

        it("should include glass type, category, and alcoholic type", async () => {
            mockedAxios.get.mockResolvedValue({
                data: { drinks: [mockDrink] },
            });

            await drinkCommand.execute(mockInteraction, mockContext);

            const embedCall = mockInteraction.editReply.mock.calls[0][0];
            const embed = embedCall.embeds[0];
            const fields = embed.data.fields;

            const glassField = fields.find((f: any) => f.name === "🥃 Glass");
            const categoryField = fields.find((f: any) => f.name === "📁 Category");
            const typeField = fields.find((f: any) => f.name === "🍸 Type");

            expect(glassField.value).toBe("Cocktail glass");
            expect(categoryField.value).toBe("Cocktail");
            expect(typeField.value).toBe("Alcoholic");
        });

        it("should log drink usage", async () => {
            mockedAxios.get.mockResolvedValue({
                data: { drinks: [mockDrink] },
            });

            await drinkCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                "drink command used",
                expect.objectContaining({
                    drinkId: "12345",
                    drinkName: "Margarita",
                    userId: "test-user-id",
                })
            );
        });

        it("should handle null drinks array", async () => {
            mockedAxios.get.mockResolvedValue({
                data: { drinks: null },
            });

            await drinkCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                "Could not fetch a drink at this time."
            );
        });

        it("should handle empty drinks array", async () => {
            mockedAxios.get.mockResolvedValue({
                data: { drinks: [] },
            });

            await drinkCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                "Could not fetch a drink at this time."
            );
        });

        it("should handle API errors gracefully", async () => {
            mockedAxios.get.mockRejectedValue(new Error("Network error"));

            await drinkCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalled();
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                "Sorry, I could not fetch a drink at this time."
            );
        });

        it("should handle errors before defer completes", async () => {
            // If deferReply throws, we should use reply instead
            mockInteraction.deferReply.mockRejectedValue(new Error("Defer failed"));

            await drinkCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                "Sorry, I could not fetch a drink at this time."
            );
        });

        it("should handle drink with no ingredients gracefully", async () => {
            const drinkNoIngredients = {
                ...mockDrink,
                strIngredient1: null,
                strIngredient2: null,
                strIngredient3: null,
                strMeasure1: null,
                strMeasure2: null,
                strMeasure3: null,
            };

            mockedAxios.get.mockResolvedValue({
                data: { drinks: [drinkNoIngredients] },
            });

            await drinkCommand.execute(mockInteraction, mockContext);

            const embedCall = mockInteraction.editReply.mock.calls[0][0];
            const embed = embedCall.embeds[0];
            const ingredientsField = embed.data.fields.find(
                (f: any) => f.name === "📋 Ingredients"
            );

            expect(ingredientsField.value).toBe("No ingredients listed");
        });

        it("should handle ingredients without measures", async () => {
            const drinkNoMeasures = {
                ...mockDrink,
                strMeasure1: null,
                strMeasure2: null,
                strMeasure3: null,
            };

            mockedAxios.get.mockResolvedValue({
                data: { drinks: [drinkNoMeasures] },
            });

            await drinkCommand.execute(mockInteraction, mockContext);

            const embedCall = mockInteraction.editReply.mock.calls[0][0];
            const embed = embedCall.embeds[0];
            const ingredientsField = embed.data.fields.find(
                (f: any) => f.name === "📋 Ingredients"
            );

            expect(ingredientsField.value).toContain("Tequila");
            expect(ingredientsField.value).not.toContain("2 oz");
        });

        it("should handle missing glass, category, or type", async () => {
            const drinkMissingFields = {
                ...mockDrink,
                strGlass: null,
                strCategory: null,
                strAlcoholic: null,
            };

            mockedAxios.get.mockResolvedValue({
                data: { drinks: [drinkMissingFields] },
            });

            await drinkCommand.execute(mockInteraction, mockContext);

            const embedCall = mockInteraction.editReply.mock.calls[0][0];
            const embed = embedCall.embeds[0];
            const fields = embed.data.fields;

            const glassField = fields.find((f: any) => f.name === "🥃 Glass");
            const categoryField = fields.find((f: any) => f.name === "📁 Category");
            const typeField = fields.find((f: any) => f.name === "🍸 Type");

            expect(glassField.value).toBe("Unknown");
            expect(categoryField.value).toBe("Unknown");
            expect(typeField.value).toBe("Unknown");
        });
    });
});
