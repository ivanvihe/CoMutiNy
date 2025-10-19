import Phaser from 'phaser';

type ColorInput = string | number;

const clamp = (value: number): number => Math.max(0, Math.min(255, value));

const expandHex = (hex: string): string => {
  if (hex.length === 3) {
    return hex
      .split('')
      .map((char) => char + char)
      .join('');
  }
  return hex;
};

const normalizeHex = (color: string): string => {
  const trimmed = color.trim();
  if (trimmed.startsWith('#')) {
    return expandHex(trimmed.slice(1));
  }
  if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
    return expandHex(trimmed.slice(2));
  }
  return expandHex(trimmed);
};

const parseColor = (color: ColorInput): [number, number, number] => {
  if (typeof color === 'number') {
    const red = (color >> 16) & 0xff;
    const green = (color >> 8) & 0xff;
    const blue = color & 0xff;
    return [red, green, blue];
  }

  const hex = normalizeHex(color);
  const numeric = Number.parseInt(hex, 16);
  const red = (numeric >> 16) & 0xff;
  const green = (numeric >> 8) & 0xff;
  const blue = numeric & 0xff;
  return [red, green, blue];
};

const toHexString = (red: number, green: number, blue: number): string => {
  const toHex = Phaser.Display.Color.ComponentToHex;
  return `#${toHex(clamp(red))}${toHex(clamp(green))}${toHex(clamp(blue))}`;
};

const adjust = (color: ColorInput, amount: number, mode: 'lighten' | 'darken'): string => {
  const clampedAmount = Math.max(0, Math.min(1, amount));
  const [red, green, blue] = parseColor(color);

  if (mode === 'lighten') {
    return toHexString(
      red + (255 - red) * clampedAmount,
      green + (255 - green) * clampedAmount,
      blue + (255 - blue) * clampedAmount
    );
  }

  return toHexString(
    red * (1 - clampedAmount),
    green * (1 - clampedAmount),
    blue * (1 - clampedAmount)
  );
};

export const lighten = (color: ColorInput, amount: number): string =>
  adjust(color, amount, 'lighten');

export const darken = (color: ColorInput, amount: number): string =>
  adjust(color, amount, 'darken');
