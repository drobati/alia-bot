/**
 * Color utility functions for conversion, palette generation, and accessibility.
 */

export interface RGB {
    r: number;
    g: number;
    b: number;
}

export interface HSL {
    h: number;
    s: number;
    l: number;
}

export interface ColorInfo {
    hex: string;
    rgb: RGB;
    hsl: HSL;
    name?: string;
}

/**
 * Parse a color string (hex or rgb) into RGB values.
 */
export function parseColor(input: string): RGB | null {
    const trimmed = input.trim().toLowerCase();

    // Try hex format: #fff, #ffffff, fff, ffffff
    const hexMatch = trimmed.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/);
    if (hexMatch) {
        return hexToRgb(hexMatch[1]);
    }

    // Try rgb format: rgb(255, 255, 255) or 255, 255, 255
    const rgbMatch = trimmed.match(/^(?:rgb\s*\(\s*)?(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)?$/);
    if (rgbMatch) {
        const r = parseInt(rgbMatch[1], 10);
        const g = parseInt(rgbMatch[2], 10);
        const b = parseInt(rgbMatch[3], 10);
        if (r <= 255 && g <= 255 && b <= 255) {
            return { r, g, b };
        }
    }

    // Try hsl format: hsl(360, 100%, 50%)
    const hslMatch = trimmed.match(/^hsl\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})%?\s*,\s*(\d{1,3})%?\s*\)$/);
    if (hslMatch) {
        const h = parseInt(hslMatch[1], 10);
        const s = parseInt(hslMatch[2], 10);
        const l = parseInt(hslMatch[3], 10);
        if (h <= 360 && s <= 100 && l <= 100) {
            return hslToRgb({ h, s, l });
        }
    }

    return null;
}

/**
 * Convert hex string to RGB.
 */
export function hexToRgb(hex: string): RGB {
    let fullHex = hex.replace('#', '');

    // Expand shorthand (fff -> ffffff)
    if (fullHex.length === 3) {
        fullHex = fullHex[0] + fullHex[0] + fullHex[1] + fullHex[1] + fullHex[2] + fullHex[2];
    }

    const num = parseInt(fullHex, 16);
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255,
    };
}

/**
 * Convert RGB to hex string.
 */
export function rgbToHex(rgb: RGB): string {
    const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Convert RGB to HSL.
 */
export function rgbToHsl(rgb: RGB): HSL {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    if (max === min) {
        return { h: 0, s: 0, l: Math.round(l * 100) };
    }

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    let h: number;
    switch (max) {
        case r:
            h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            break;
        case g:
            h = ((b - r) / d + 2) / 6;
            break;
        default:
            h = ((r - g) / d + 4) / 6;
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100),
    };
}

/**
 * Convert HSL to RGB.
 */
export function hslToRgb(hsl: HSL): RGB {
    const h = hsl.h / 360;
    const s = hsl.s / 100;
    const l = hsl.l / 100;

    if (s === 0) {
        const gray = Math.round(l * 255);
        return { r: gray, g: gray, b: gray };
    }

    const hue2rgb = (p: number, q: number, t: number): number => {
        let tNorm = t;
        if (tNorm < 0) {tNorm += 1;}
        if (tNorm > 1) {tNorm -= 1;}
        if (tNorm < 1 / 6) {return p + (q - p) * 6 * tNorm;}
        if (tNorm < 1 / 2) {return q;}
        if (tNorm < 2 / 3) {return p + (q - p) * (2 / 3 - tNorm) * 6;}
        return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    return {
        r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
        g: Math.round(hue2rgb(p, q, h) * 255),
        b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
    };
}

/**
 * Get full color information from RGB.
 */
export function getColorInfo(rgb: RGB): ColorInfo {
    return {
        hex: rgbToHex(rgb),
        rgb,
        hsl: rgbToHsl(rgb),
    };
}

/**
 * Calculate relative luminance for WCAG contrast calculations.
 */
export function getRelativeLuminance(rgb: RGB): number {
    const srgb = [rgb.r, rgb.g, rgb.b].map(c => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

/**
 * Calculate contrast ratio between two colors.
 */
export function getContrastRatio(rgb1: RGB, rgb2: RGB): number {
    const l1 = getRelativeLuminance(rgb1);
    const l2 = getRelativeLuminance(rgb2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Get WCAG compliance level for a contrast ratio.
 */
export function getWcagLevel(contrastRatio: number): string {
    if (contrastRatio >= 7) {return 'AAA';}
    if (contrastRatio >= 4.5) {return 'AA';}
    if (contrastRatio >= 3) {return 'AA Large';}
    return 'Fail';
}

/**
 * Generate complementary color (opposite on color wheel).
 */
export function getComplementary(rgb: RGB): RGB {
    const hsl = rgbToHsl(rgb);
    return hslToRgb({ ...hsl, h: (hsl.h + 180) % 360 });
}

/**
 * Generate analogous colors (adjacent on color wheel).
 */
export function getAnalogous(rgb: RGB): RGB[] {
    const hsl = rgbToHsl(rgb);
    return [
        hslToRgb({ ...hsl, h: (hsl.h - 30 + 360) % 360 }),
        rgb,
        hslToRgb({ ...hsl, h: (hsl.h + 30) % 360 }),
    ];
}

/**
 * Generate triadic colors (evenly spaced on color wheel).
 */
export function getTriadic(rgb: RGB): RGB[] {
    const hsl = rgbToHsl(rgb);
    return [
        rgb,
        hslToRgb({ ...hsl, h: (hsl.h + 120) % 360 }),
        hslToRgb({ ...hsl, h: (hsl.h + 240) % 360 }),
    ];
}

/**
 * Generate split-complementary colors.
 */
export function getSplitComplementary(rgb: RGB): RGB[] {
    const hsl = rgbToHsl(rgb);
    return [
        rgb,
        hslToRgb({ ...hsl, h: (hsl.h + 150) % 360 }),
        hslToRgb({ ...hsl, h: (hsl.h + 210) % 360 }),
    ];
}

/**
 * Generate tetradic (square) colors.
 */
export function getTetradic(rgb: RGB): RGB[] {
    const hsl = rgbToHsl(rgb);
    return [
        rgb,
        hslToRgb({ ...hsl, h: (hsl.h + 90) % 360 }),
        hslToRgb({ ...hsl, h: (hsl.h + 180) % 360 }),
        hslToRgb({ ...hsl, h: (hsl.h + 270) % 360 }),
    ];
}

/**
 * Generate shades (darker versions) of a color.
 */
export function getShades(rgb: RGB, count: number = 5): RGB[] {
    const hsl = rgbToHsl(rgb);
    const shades: RGB[] = [];
    const step = hsl.l / (count + 1);

    for (let i = 1; i <= count; i++) {
        shades.push(hslToRgb({ ...hsl, l: Math.max(0, hsl.l - step * i) }));
    }

    return shades;
}

/**
 * Generate tints (lighter versions) of a color.
 */
export function getTints(rgb: RGB, count: number = 5): RGB[] {
    const hsl = rgbToHsl(rgb);
    const tints: RGB[] = [];
    const step = (100 - hsl.l) / (count + 1);

    for (let i = 1; i <= count; i++) {
        tints.push(hslToRgb({ ...hsl, l: Math.min(100, hsl.l + step * i) }));
    }

    return tints;
}

/**
 * Generate a random color.
 */
export function getRandomColor(): RGB {
    return {
        r: Math.floor(Math.random() * 256),
        g: Math.floor(Math.random() * 256),
        b: Math.floor(Math.random() * 256),
    };
}

/**
 * Convert RGB to Discord embed color integer.
 */
export function rgbToInt(rgb: RGB): number {
    return (rgb.r << 16) + (rgb.g << 8) + rgb.b;
}

/**
 * Determine if a color is light or dark.
 */
export function isLightColor(rgb: RGB): boolean {
    return getRelativeLuminance(rgb) > 0.179;
}

/**
 * Get appropriate text color (black or white) for a background.
 */
export function getTextColor(background: RGB): RGB {
    return isLightColor(background) ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
}
