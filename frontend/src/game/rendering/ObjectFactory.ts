import Phaser from 'phaser';
import { darken, lighten } from './colors';

export interface DiamondTextureConfig {
  key?: string;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth?: number;
  fillAlpha?: number;
  strokeAlpha?: number;
  highlight?: string | null;
  highlightAlpha?: number;
  shadow?: string | null;
  shadowAlpha?: number;
}

interface NormalizedDiamondConfig {
  key?: string;
  width: number;
  height: number;
  fill: string;
  fillAlpha: number;
  stroke: string;
  strokeAlpha: number;
  strokeWidth: number;
  highlightColor: string | null;
  highlightAlpha: number;
  shadowColor: string | null;
  shadowAlpha: number;
}

const cache = new Map<string, string>();

const colorToNumber = (color: string): number => Phaser.Display.Color.HexStringToColor(color).color;

const normalizeDiamondConfig = (config: DiamondTextureConfig): NormalizedDiamondConfig => {
  const fill = config.fill;
  const fillAlpha = config.fillAlpha ?? 1;
  const stroke = config.stroke;
  const strokeAlpha = config.strokeAlpha ?? 1;
  const strokeWidth = config.strokeWidth ?? 2;

  const highlightColor =
    config.highlight === null ? null : (config.highlight ?? lighten(fill, 0.18));
  const highlightAlpha = highlightColor ? (config.highlightAlpha ?? 0.55) : 0;

  const shadowColor = config.shadow === null ? null : (config.shadow ?? darken(fill, 0.25));
  const shadowAlpha = shadowColor ? (config.shadowAlpha ?? 0.5) : 0;

  return {
    key: config.key,
    width: config.width,
    height: config.height,
    fill,
    fillAlpha,
    stroke,
    strokeAlpha,
    strokeWidth,
    highlightColor,
    highlightAlpha,
    shadowColor,
    shadowAlpha,
  };
};

const serializeDiamondConfig = (config: NormalizedDiamondConfig): string => {
  const rest = { ...config };
  delete rest.key;
  return JSON.stringify(rest);
};

export class ObjectFactory {
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  renderDiamond(config: DiamondTextureConfig): string {
    const normalized = normalizeDiamondConfig(config);
    const signature = serializeDiamondConfig(normalized);

    if (normalized.key && this.scene.textures.exists(normalized.key)) {
      cache.set(signature, normalized.key);
      return normalized.key;
    }

    const existingKey = cache.get(signature);
    if (existingKey && this.scene.textures.exists(existingKey)) {
      return existingKey;
    }

    const width = normalized.width;
    const height = normalized.height;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    const graphics = this.scene.make.graphics({ add: false });
    graphics.clear();

    // Base diamond
    graphics.fillStyle(colorToNumber(normalized.fill), normalized.fillAlpha);
    graphics.beginPath();
    graphics.moveTo(halfWidth, 0);
    graphics.lineTo(width, halfHeight);
    graphics.lineTo(halfWidth, height);
    graphics.lineTo(0, halfHeight);
    graphics.closePath();
    graphics.fillPath();

    // Highlight (top triangle)
    if (normalized.highlightColor && normalized.highlightAlpha > 0) {
      graphics.fillStyle(colorToNumber(normalized.highlightColor), normalized.highlightAlpha);
      graphics.beginPath();
      graphics.moveTo(halfWidth, 0);
      graphics.lineTo(width, halfHeight);
      graphics.lineTo(0, halfHeight);
      graphics.closePath();
      graphics.fillPath();
    }

    // Shadow (bottom triangle)
    if (normalized.shadowColor && normalized.shadowAlpha > 0) {
      graphics.fillStyle(colorToNumber(normalized.shadowColor), normalized.shadowAlpha);
      graphics.beginPath();
      graphics.moveTo(halfWidth, height);
      graphics.lineTo(width, halfHeight);
      graphics.lineTo(0, halfHeight);
      graphics.closePath();
      graphics.fillPath();
    }

    if (normalized.strokeWidth > 0) {
      graphics.lineStyle(
        normalized.strokeWidth,
        colorToNumber(normalized.stroke),
        normalized.strokeAlpha
      );
      graphics.beginPath();
      graphics.moveTo(halfWidth, 0);
      graphics.lineTo(width, halfHeight);
      graphics.lineTo(halfWidth, height);
      graphics.lineTo(0, halfHeight);
      graphics.closePath();
      graphics.strokePath();
    }

    const key = normalized.key ?? `object-${Phaser.Utils.String.UUID()}`;
    const renderTexture = this.scene.make.renderTexture({ width, height, add: false });
    renderTexture.draw(graphics);
    renderTexture.saveTexture(key);
    renderTexture.destroy();
    graphics.destroy();

    cache.set(signature, key);

    return key;
  }
}
