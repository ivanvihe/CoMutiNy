import { useEffect, useState } from 'react';
import { ensureCharacterTexture } from '../game/characters/textureLoader.js';

const resolvePreviewSource = (image) => {
  if (!image) {
    return null;
  }

  if (typeof image === 'string') {
    return image;
  }

  if (typeof image.toDataURL === 'function') {
    try {
      return image.toDataURL('image/png');
    } catch (error) {
      return null;
    }
  }

  if (typeof image.src === 'string') {
    return image.src;
  }

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    const width = image.width ?? 96;
    const height = image.height ?? 128;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }
    ctx.drawImage(image, 0, 0, width, height);
    try {
      return canvas.toDataURL('image/png');
    } catch (error) {
      return null;
    }
  }

  return null;
};

export default function useCharacterTexturePreview(textureId) {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    let cancelled = false;

    if (!textureId) {
      setPreview(null);
      return () => {
        cancelled = true;
      };
    }

    const entry = ensureCharacterTexture(textureId);

    const assignPreview = (image) => {
      if (cancelled) {
        return;
      }
      const resolved = resolvePreviewSource(image);
      setPreview(resolved);
    };

    if (entry.status === 'loaded' && entry.image) {
      assignPreview(entry.image);
      return () => {
        cancelled = true;
      };
    }

    if (entry.promise) {
      entry.promise
        .then((image) => {
          if (!cancelled) {
            assignPreview(image);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setPreview(null);
          }
        });
    } else {
      setPreview(null);
    }

    return () => {
      cancelled = true;
    };
  }, [textureId]);

  return preview;
}
