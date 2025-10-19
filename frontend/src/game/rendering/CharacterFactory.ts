import Phaser from 'phaser';
import { darken, lighten } from './colors';

export interface CharacterAppearanceConfig {
  skin: string;
  hair: string;
  eyes: string;
  shirt: string;
  pants: string;
  accent: string;
  outline?: string;
}

export interface CharacterFactoryOptions {
  width?: number;
  height?: number;
}

const DEFAULT_WIDTH = 48;
const DEFAULT_HEIGHT = 48;

const cache = new Map<string, string>();

const normalizeConfig = (config: CharacterAppearanceConfig): CharacterAppearanceConfig => ({
  ...config,
  outline: config.outline ?? '#1a1a1a',
});

const serializeConfig = (
  config: CharacterAppearanceConfig,
  options?: CharacterFactoryOptions
): string => {
  const normalized = normalizeConfig(config);
  return JSON.stringify({
    appearance: normalized,
    width: options?.width ?? DEFAULT_WIDTH,
    height: options?.height ?? DEFAULT_HEIGHT,
  });
};

const colorToNumber = (color: string): number => Phaser.Display.Color.HexStringToColor(color).color;

export class CharacterFactory {
  private readonly scene: Phaser.Scene;
  private readonly options: CharacterFactoryOptions;

  constructor(scene: Phaser.Scene, options?: CharacterFactoryOptions) {
    this.scene = scene;
    this.options = options ?? {};
  }

  render(config: CharacterAppearanceConfig, cacheKey?: string): string {
    const normalized = normalizeConfig(config);
    const signature = cacheKey ?? serializeConfig(normalized, this.options);
    const existingKey = cache.get(signature);

    if (existingKey && this.scene.textures.exists(existingKey)) {
      return existingKey;
    }

    const width = this.options.width ?? DEFAULT_WIDTH;
    const height = this.options.height ?? DEFAULT_HEIGHT;
    const centerX = width / 2;

    const bodyWidth = Math.round(width * 0.42);
    const bodyHeight = Math.round(height * 0.36);
    const legHeight = Math.round(height * 0.28);
    const legWidth = Math.round(bodyWidth * 0.42);
    const legGap = Math.max(2, Math.round(width * 0.06));
    const headRadiusX = Math.round(width * 0.18);
    const headRadiusY = Math.round(height * 0.18);
    const headCenterY = Math.round(height * 0.28);
    const bodyTop = headCenterY + headRadiusY - Math.round(height * 0.02);
    const legTop = bodyTop + bodyHeight - Math.round(height * 0.06);
    const beltHeight = Math.max(2, Math.round(height * 0.05));
    const beltY = bodyTop + bodyHeight - beltHeight - Math.round(height * 0.04);
    const armWidth = Math.max(3, Math.round(width * 0.12));
    const armHeight = Math.max(6, Math.round(bodyHeight * 0.68));
    const shoeHeight = Math.max(3, Math.round(legHeight * 0.28));

    const hairShadow = darken(normalized.hair, 0.35);
    const hairHighlight = lighten(normalized.hair, 0.25);
    const shirtShadow = darken(normalized.shirt, 0.28);
    const shirtHighlight = lighten(normalized.shirt, 0.18);
    const pantsShadow = darken(normalized.pants, 0.32);
    const skinShadow = darken(normalized.skin, 0.15);

    const graphics = this.scene.make.graphics({ add: false });
    graphics.clear();

    // Legs
    graphics.fillStyle(colorToNumber(normalized.pants), 1);
    graphics.fillRoundedRect(centerX - legWidth - legGap / 2, legTop, legWidth, legHeight, 4);
    graphics.fillRoundedRect(centerX + legGap / 2, legTop, legWidth, legHeight, 4);

    graphics.fillStyle(colorToNumber(pantsShadow), 1);
    graphics.fillRect(
      centerX - legWidth - legGap / 2,
      legTop + legHeight - shoeHeight,
      legWidth,
      shoeHeight
    );
    graphics.fillRect(centerX + legGap / 2, legTop + legHeight - shoeHeight, legWidth, shoeHeight);

    // Body
    graphics.fillStyle(colorToNumber(normalized.shirt), 1);
    graphics.fillRoundedRect(centerX - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight, 8);
    graphics.fillStyle(colorToNumber(shirtShadow), 1);
    graphics.fillRoundedRect(
      centerX - bodyWidth / 2 + 2,
      bodyTop + 2,
      bodyWidth - 4,
      bodyHeight - 6,
      6
    );
    graphics.fillStyle(colorToNumber(shirtHighlight), 0.9);
    graphics.fillRoundedRect(
      centerX - bodyWidth / 4,
      bodyTop + 4,
      bodyWidth / 2,
      bodyHeight - 12,
      4
    );

    // Arms
    const leftArmX = centerX - bodyWidth / 2 - armWidth + 2;
    const rightArmX = centerX + bodyWidth / 2 - 2;
    const armY = bodyTop + Math.max(2, Math.round(bodyHeight * 0.16));

    graphics.fillStyle(colorToNumber(normalized.skin), 1);
    graphics.fillRoundedRect(leftArmX, armY, armWidth, armHeight, 3);
    graphics.fillRoundedRect(rightArmX, armY, armWidth, armHeight, 3);

    graphics.fillStyle(colorToNumber(skinShadow), 1);
    graphics.fillRect(leftArmX, armY, armWidth, Math.max(2, Math.round(armHeight * 0.3)));
    graphics.fillRect(rightArmX, armY, armWidth, Math.max(2, Math.round(armHeight * 0.3)));

    // Belt / accent
    graphics.fillStyle(colorToNumber(normalized.accent), 1);
    graphics.fillRect(centerX - bodyWidth / 2, beltY, bodyWidth, beltHeight);

    // Head
    graphics.fillStyle(colorToNumber(normalized.skin), 1);
    graphics.fillEllipse(centerX, headCenterY, headRadiusX, headRadiusY);
    graphics.fillStyle(colorToNumber(skinShadow), 0.6);
    graphics.fillEllipse(
      centerX,
      headCenterY + Math.round(headRadiusY * 0.4),
      headRadiusX - 2,
      headRadiusY / 2
    );

    // Hair
    graphics.fillStyle(colorToNumber(normalized.hair), 1);
    graphics.fillEllipse(
      centerX,
      headCenterY - Math.round(headRadiusY * 0.55),
      headRadiusX + 4,
      headRadiusY + 2
    );
    graphics.fillStyle(colorToNumber(hairShadow), 1);
    graphics.fillRect(
      centerX - headRadiusX - 2,
      headCenterY - headRadiusY,
      (headRadiusX + 2) * 2,
      Math.round(headRadiusY * 0.6)
    );
    graphics.fillStyle(colorToNumber(hairHighlight), 0.8);
    graphics.fillEllipse(
      centerX - headRadiusX / 2,
      headCenterY - Math.round(headRadiusY * 0.7),
      headRadiusX / 1.8,
      headRadiusY / 2
    );

    // Eyes
    const eyeWidth = Math.max(2, Math.round(width * 0.08));
    const eyeHeight = Math.max(2, Math.round(height * 0.04));
    const eyeOffsetX = Math.max(3, Math.round(width * 0.1));
    const eyeY = headCenterY;

    graphics.fillStyle(colorToNumber(normalized.eyes), 1);
    graphics.fillRoundedRect(
      centerX - eyeOffsetX - eyeWidth / 2,
      eyeY - eyeHeight / 2,
      eyeWidth,
      eyeHeight,
      2
    );
    graphics.fillRoundedRect(
      centerX + eyeOffsetX - eyeWidth / 2,
      eyeY - eyeHeight / 2,
      eyeWidth,
      eyeHeight,
      2
    );

    // Outline
    graphics.lineStyle(2, colorToNumber(normalized.outline), 1);
    graphics.strokeEllipse(centerX, headCenterY, headRadiusX, headRadiusY);
    graphics.strokeRoundedRect(centerX - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight, 8);
    graphics.strokeRoundedRect(centerX - legWidth - legGap / 2, legTop, legWidth, legHeight, 4);
    graphics.strokeRoundedRect(centerX + legGap / 2, legTop, legWidth, legHeight, 4);

    const textureKey = `character-${Phaser.Utils.String.UUID()}`;
    const renderTexture = this.scene.make.renderTexture({ width, height, add: false });
    renderTexture.draw(graphics);
    renderTexture.saveTexture(textureKey);
    renderTexture.destroy();
    graphics.destroy();

    cache.set(signature, textureKey);

    return textureKey;
  }
}

export const createCharacterTexture = (
  scene: Phaser.Scene,
  config: CharacterAppearanceConfig,
  options?: CharacterFactoryOptions
): string => {
  const normalized = normalizeConfig(config);
  const signature = serializeConfig(normalized, options);
  const existingKey = cache.get(signature);
  if (existingKey && scene.textures.exists(existingKey)) {
    return existingKey;
  }

  const factory = new CharacterFactory(scene, options);
  return factory.render(normalized, signature);
};
