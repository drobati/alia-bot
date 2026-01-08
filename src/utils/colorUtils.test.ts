import { describe, it, expect } from "@jest/globals";
import {
    parseColor,
    hexToRgb,
    rgbToHex,
    rgbToHsl,
    hslToRgb,
    getColorInfo,
    getRelativeLuminance,
    getContrastRatio,
    getWcagLevel,
    getComplementary,
    getAnalogous,
    getTriadic,
    getSplitComplementary,
    getTetradic,
    getShades,
    getTints,
    getRandomColor,
    rgbToInt,
    isLightColor,
    getTextColor,
} from "./colorUtils";

describe("Color Utils", () => {
    describe("parseColor", () => {
        it("should parse 6-digit hex with hash", () => {
            expect(parseColor("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
            expect(parseColor("#00ff00")).toEqual({ r: 0, g: 255, b: 0 });
            expect(parseColor("#0000ff")).toEqual({ r: 0, g: 0, b: 255 });
        });

        it("should parse 6-digit hex without hash", () => {
            expect(parseColor("ff0000")).toEqual({ r: 255, g: 0, b: 0 });
        });

        it("should parse 3-digit hex", () => {
            expect(parseColor("#f00")).toEqual({ r: 255, g: 0, b: 0 });
            expect(parseColor("fff")).toEqual({ r: 255, g: 255, b: 255 });
        });

        it("should parse RGB format", () => {
            expect(parseColor("255, 0, 0")).toEqual({ r: 255, g: 0, b: 0 });
            expect(parseColor("rgb(255, 0, 0)")).toEqual({ r: 255, g: 0, b: 0 });
            expect(parseColor("rgb(128, 128, 128)")).toEqual({ r: 128, g: 128, b: 128 });
        });

        it("should parse HSL format", () => {
            const result = parseColor("hsl(0, 100%, 50%)");
            expect(result).not.toBeNull();
            expect(result?.r).toBe(255);
            expect(result?.g).toBe(0);
            expect(result?.b).toBe(0);
        });

        it("should return null for invalid input", () => {
            expect(parseColor("invalid")).toBeNull();
            expect(parseColor("")).toBeNull();
            expect(parseColor("#gggggg")).toBeNull();
            expect(parseColor("rgb(300, 0, 0)")).toBeNull();
        });

        it("should be case insensitive", () => {
            expect(parseColor("#FF0000")).toEqual({ r: 255, g: 0, b: 0 });
            expect(parseColor("RGB(255, 0, 0)")).toEqual({ r: 255, g: 0, b: 0 });
        });
    });

    describe("hexToRgb", () => {
        it("should convert 6-digit hex to RGB", () => {
            expect(hexToRgb("ffffff")).toEqual({ r: 255, g: 255, b: 255 });
            expect(hexToRgb("000000")).toEqual({ r: 0, g: 0, b: 0 });
            expect(hexToRgb("ff5733")).toEqual({ r: 255, g: 87, b: 51 });
        });

        it("should expand 3-digit hex", () => {
            expect(hexToRgb("fff")).toEqual({ r: 255, g: 255, b: 255 });
            expect(hexToRgb("f00")).toEqual({ r: 255, g: 0, b: 0 });
        });
    });

    describe("rgbToHex", () => {
        it("should convert RGB to hex", () => {
            expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe("#ffffff");
            expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe("#000000");
            expect(rgbToHex({ r: 255, g: 87, b: 51 })).toBe("#ff5733");
        });

        it("should clamp out of range values", () => {
            expect(rgbToHex({ r: 300, g: -10, b: 128 })).toBe("#ff0080");
        });
    });

    describe("rgbToHsl", () => {
        it("should convert RGB to HSL", () => {
            // Pure red
            expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 });
            // Pure green
            expect(rgbToHsl({ r: 0, g: 255, b: 0 })).toEqual({ h: 120, s: 100, l: 50 });
            // Pure blue
            expect(rgbToHsl({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 100, l: 50 });
            // White
            expect(rgbToHsl({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, l: 100 });
            // Black
            expect(rgbToHsl({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, l: 0 });
        });
    });

    describe("hslToRgb", () => {
        it("should convert HSL to RGB", () => {
            // Pure red
            expect(hslToRgb({ h: 0, s: 100, l: 50 })).toEqual({ r: 255, g: 0, b: 0 });
            // Pure green
            expect(hslToRgb({ h: 120, s: 100, l: 50 })).toEqual({ r: 0, g: 255, b: 0 });
            // Gray (no saturation)
            expect(hslToRgb({ h: 0, s: 0, l: 50 })).toEqual({ r: 128, g: 128, b: 128 });
        });
    });

    describe("getColorInfo", () => {
        it("should return full color info", () => {
            const info = getColorInfo({ r: 255, g: 0, b: 0 });
            expect(info.hex).toBe("#ff0000");
            expect(info.rgb).toEqual({ r: 255, g: 0, b: 0 });
            expect(info.hsl).toEqual({ h: 0, s: 100, l: 50 });
        });
    });

    describe("getRelativeLuminance", () => {
        it("should calculate luminance correctly", () => {
            expect(getRelativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 2);
            expect(getRelativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 2);
        });
    });

    describe("getContrastRatio", () => {
        it("should calculate contrast ratio", () => {
            const white = { r: 255, g: 255, b: 255 };
            const black = { r: 0, g: 0, b: 0 };
            expect(getContrastRatio(white, black)).toBeCloseTo(21, 0);
            expect(getContrastRatio(white, white)).toBeCloseTo(1, 0);
        });
    });

    describe("getWcagLevel", () => {
        it("should return correct WCAG levels", () => {
            expect(getWcagLevel(21)).toBe("AAA");
            expect(getWcagLevel(7)).toBe("AAA");
            expect(getWcagLevel(5)).toBe("AA");
            expect(getWcagLevel(4.5)).toBe("AA");
            expect(getWcagLevel(3.5)).toBe("AA Large");
            expect(getWcagLevel(2)).toBe("Fail");
        });
    });

    describe("Color Palette Functions", () => {
        const red = { r: 255, g: 0, b: 0 };

        it("getComplementary should return opposite color", () => {
            const comp = getComplementary(red);
            const hsl = rgbToHsl(comp);
            expect(hsl.h).toBe(180); // Cyan is opposite of red
        });

        it("getAnalogous should return 3 colors", () => {
            const colors = getAnalogous(red);
            expect(colors).toHaveLength(3);
        });

        it("getTriadic should return 3 evenly spaced colors", () => {
            const colors = getTriadic(red);
            expect(colors).toHaveLength(3);
        });

        it("getSplitComplementary should return 3 colors", () => {
            const colors = getSplitComplementary(red);
            expect(colors).toHaveLength(3);
        });

        it("getTetradic should return 4 colors", () => {
            const colors = getTetradic(red);
            expect(colors).toHaveLength(4);
        });

        it("getShades should return darker versions", () => {
            const shades = getShades(red, 3);
            expect(shades).toHaveLength(3);
            shades.forEach(shade => {
                const hsl = rgbToHsl(shade);
                expect(hsl.l).toBeLessThan(50); // Darker than original
            });
        });

        it("getTints should return lighter versions", () => {
            const tints = getTints(red, 3);
            expect(tints).toHaveLength(3);
            tints.forEach(tint => {
                const hsl = rgbToHsl(tint);
                expect(hsl.l).toBeGreaterThan(50); // Lighter than original
            });
        });
    });

    describe("getRandomColor", () => {
        it("should return valid RGB values", () => {
            const color = getRandomColor();
            expect(color.r).toBeGreaterThanOrEqual(0);
            expect(color.r).toBeLessThanOrEqual(255);
            expect(color.g).toBeGreaterThanOrEqual(0);
            expect(color.g).toBeLessThanOrEqual(255);
            expect(color.b).toBeGreaterThanOrEqual(0);
            expect(color.b).toBeLessThanOrEqual(255);
        });
    });

    describe("rgbToInt", () => {
        it("should convert RGB to integer", () => {
            expect(rgbToInt({ r: 255, g: 0, b: 0 })).toBe(0xff0000);
            expect(rgbToInt({ r: 0, g: 255, b: 0 })).toBe(0x00ff00);
            expect(rgbToInt({ r: 0, g: 0, b: 255 })).toBe(0x0000ff);
            expect(rgbToInt({ r: 255, g: 255, b: 255 })).toBe(0xffffff);
        });
    });

    describe("isLightColor", () => {
        it("should identify light colors", () => {
            expect(isLightColor({ r: 255, g: 255, b: 255 })).toBe(true);
            expect(isLightColor({ r: 255, g: 255, b: 0 })).toBe(true);
        });

        it("should identify dark colors", () => {
            expect(isLightColor({ r: 0, g: 0, b: 0 })).toBe(false);
            expect(isLightColor({ r: 0, g: 0, b: 128 })).toBe(false);
        });
    });

    describe("getTextColor", () => {
        it("should return black for light backgrounds", () => {
            expect(getTextColor({ r: 255, g: 255, b: 255 })).toEqual({ r: 0, g: 0, b: 0 });
        });

        it("should return white for dark backgrounds", () => {
            expect(getTextColor({ r: 0, g: 0, b: 0 })).toEqual({ r: 255, g: 255, b: 255 });
        });
    });
});
