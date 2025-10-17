import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Divider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from '@mui/material';

const DEFAULT_GRID_SIZE = 16;
const DEFAULT_COLORS = [
  '#000000',
  '#ffffff',
  '#ff0054',
  '#ffbd00',
  '#00c2ff',
  '#38b000',
  '#8338ec',
  '#f77f00'
];
const PIXEL_DISPLAY_SIZE = 20;

const TOOL_PEN = 'pen';
const TOOL_ERASER = 'eraser';
const TOOL_PICKER = 'picker';

const createEmptyGrid = (size) =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => null));

const toRgbaString = (data, index) => {
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  const a = data[index + 3];

  if (a === 0) {
    return null;
  }

  const alpha = (a / 255).toFixed(2);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const uniquePalette = (grid) => {
  const colors = new Set();

  for (const row of grid) {
    for (const color of row) {
      if (color) {
        colors.add(color);
      }
    }
  }

  return Array.from(colors);
};

export default function SpriteCanvasEditor({
  initialImage,
  initialMetadata,
  onChange,
  gridSize = DEFAULT_GRID_SIZE
}) {
  const [pixels, setPixels] = useState(() => createEmptyGrid(gridSize));
  const [tool, setTool] = useState(TOOL_PEN);
  const [currentColor, setCurrentColor] = useState(DEFAULT_COLORS[0]);
  const [colorInput, setColorInput] = useState(DEFAULT_COLORS[0]);
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef(null);
  const ignoreInitialImageRef = useRef(false);
  const metadataAppliedRef = useRef(false);

  const canvasSize = useMemo(() => gridSize * PIXEL_DISPLAY_SIZE, [gridSize]);

  const setPixel = useCallback((x, y, color) => {
    setPixels((prev) => {
      if (!prev[y] || prev[y][x] === color) {
        return prev;
      }

      const next = prev.map((row, rowIndex) =>
        rowIndex === y ? row.map((value, columnIndex) => (columnIndex === x ? color : value)) : row
      );

      return next;
    });
  }, []);

  const clearPixels = useCallback(() => {
    setPixels(createEmptyGrid(gridSize));
    ignoreInitialImageRef.current = true;
  }, [gridSize]);

  const drawGrid = useCallback(
    (grid) => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      const context = canvas.getContext('2d', { willReadFrequently: true });

      if (!context) {
        return;
      }

      context.clearRect(0, 0, canvas.width, canvas.height);

      for (let y = 0; y < gridSize; y += 1) {
        for (let x = 0; x < gridSize; x += 1) {
          const color = grid[y][x];
          const startX = x * PIXEL_DISPLAY_SIZE;
          const startY = y * PIXEL_DISPLAY_SIZE;

          if (!color) {
            const checkerboard = (x + y) % 2 === 0 ? '#f5f5f5' : '#e0e0e0';
            context.fillStyle = checkerboard;
            context.fillRect(startX, startY, PIXEL_DISPLAY_SIZE, PIXEL_DISPLAY_SIZE);
          } else {
            context.fillStyle = color;
            context.fillRect(startX, startY, PIXEL_DISPLAY_SIZE, PIXEL_DISPLAY_SIZE);
          }
        }
      }

      context.strokeStyle = 'rgba(0,0,0,0.2)';
      context.lineWidth = 1;

      for (let i = 0; i <= gridSize; i += 1) {
        const position = i * PIXEL_DISPLAY_SIZE + 0.5;

        context.beginPath();
        context.moveTo(position, 0);
        context.lineTo(position, canvas.height);
        context.stroke();

        context.beginPath();
        context.moveTo(0, position);
        context.lineTo(canvas.width, position);
        context.stroke();
      }
    },
    [gridSize]
  );

  const exportSprite = useCallback(
    (grid) => {
      if (!onChange) {
        return;
      }

      const offscreen = document.createElement('canvas');
      offscreen.width = gridSize;
      offscreen.height = gridSize;
      const context = offscreen.getContext('2d');

      if (!context) {
        return;
      }

      context.clearRect(0, 0, gridSize, gridSize);

      for (let y = 0; y < gridSize; y += 1) {
        for (let x = 0; x < gridSize; x += 1) {
          const color = grid[y][x];

          if (!color) {
            continue;
          }

          context.fillStyle = color;
          context.fillRect(x, y, 1, 1);
        }
      }

      const palette = uniquePalette(grid);
      const dataUrl = offscreen.toDataURL('image/png');

      onChange({
        imageUrl: dataUrl,
        metadata: {
          width: gridSize,
          height: gridSize,
          palette
        }
      });
    },
    [gridSize, onChange]
  );

  useEffect(() => {
    drawGrid(pixels);
    exportSprite(pixels);
  }, [pixels, drawGrid, exportSprite]);

  useEffect(() => {
    if (!initialImage || ignoreInitialImageRef.current) {
      ignoreInitialImageRef.current = false;
      return;
    }

    let isMounted = true;
    const image = new Image();
    image.crossOrigin = 'anonymous';

    image.onload = () => {
      if (!isMounted) {
        return;
      }

      try {
        const targetSize = gridSize;
        const offscreen = document.createElement('canvas');
        offscreen.width = targetSize;
        offscreen.height = targetSize;
        const context = offscreen.getContext('2d');

        if (!context) {
          return;
        }

        context.clearRect(0, 0, targetSize, targetSize);
        context.drawImage(image, 0, 0, targetSize, targetSize);
        const imageData = context.getImageData(0, 0, targetSize, targetSize);

        setPixels(() => {
          const next = createEmptyGrid(targetSize);

          for (let y = 0; y < targetSize; y += 1) {
            for (let x = 0; x < targetSize; x += 1) {
              const index = (y * targetSize + x) * 4;
              next[y][x] = toRgbaString(imageData.data, index);
            }
          }

          return next;
        });
      } catch (error) {
        console.warn('No se pudo cargar el sprite en el editor.', error);
      }
    };

    image.onerror = () => {
      if (!isMounted) {
        return;
      }

      console.warn('SpriteCanvasEditor: imagen inicial no disponible.');
    };

    image.src = initialImage;

    return () => {
      isMounted = false;
    };
  }, [gridSize, initialImage]);

  useEffect(() => {
    if (metadataAppliedRef.current) {
      return;
    }

    if (!initialMetadata || typeof initialMetadata !== 'object') {
      return;
    }

    if (initialMetadata.palette && Array.isArray(initialMetadata.palette) && initialMetadata.palette.length > 0) {
      setCurrentColor(initialMetadata.palette[0]);
      setColorInput(initialMetadata.palette[0]);
    }

    metadataAppliedRef.current = true;
  }, [initialMetadata]);

  const projectPointerToGrid = useCallback(
    (event) => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return null;
      }

      const rect = canvas.getBoundingClientRect();
      const x = Math.floor(((event.clientX - rect.left) / rect.width) * gridSize);
      const y = Math.floor(((event.clientY - rect.top) / rect.height) * gridSize);

      if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) {
        return null;
      }

      return { x, y };
    },
    [gridSize]
  );

  const applyTool = useCallback(
    (point, isPrimaryAction = true) => {
      if (!point) {
        return;
      }

      if (tool === TOOL_PICKER) {
        const color = pixels[point.y]?.[point.x];

        if (color) {
          setCurrentColor(color);
          setColorInput(color);
        }

        return;
      }

      const colorToApply = tool === TOOL_ERASER || !isPrimaryAction ? null : currentColor;
      setPixel(point.x, point.y, colorToApply);
    },
    [currentColor, pixels, setPixel, tool]
  );

  const handlePointerDown = useCallback(
    (event) => {
      event.preventDefault();
      const point = projectPointerToGrid(event);

      if (!point) {
        return;
      }

      isDrawing.current = true;
      lastPoint.current = point;
      applyTool(point, event.button !== 2);
    },
    [applyTool, projectPointerToGrid]
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (!isDrawing.current) {
        return;
      }

      const point = projectPointerToGrid(event);

      if (!point) {
        return;
      }

      const previous = lastPoint.current;
      lastPoint.current = point;

      if (!previous || (previous.x === point.x && previous.y === point.y)) {
        applyTool(point);
        return;
      }

      // Bresenham's line algorithm for smoother strokes
      const deltaX = Math.abs(point.x - previous.x);
      const deltaY = Math.abs(point.y - previous.y);
      const signX = previous.x < point.x ? 1 : -1;
      const signY = previous.y < point.y ? 1 : -1;

      let error = deltaX - deltaY;
      let current = { ...previous };

      while (!(current.x === point.x && current.y === point.y)) {
        applyTool(current);
        const error2 = error * 2;

        if (error2 > -deltaY) {
          error -= deltaY;
          current.x += signX;
        }

        if (error2 < deltaX) {
          error += deltaX;
          current.y += signY;
        }
      }

      applyTool(point);
    },
    [applyTool, projectPointerToGrid]
  );

  const stopDrawing = useCallback((event) => {
    if (event) {
      event.preventDefault();
    }

    isDrawing.current = false;
    lastPoint.current = null;
  }, []);

  const handleToolChange = useCallback((_, nextTool) => {
    if (!nextTool) {
      return;
    }

    setTool(nextTool);
  }, []);

  const handleColorInputChange = useCallback((event) => {
    const value = event.target.value;
    setColorInput(value);
    setCurrentColor(value);
  }, []);

  const handlePaletteClick = useCallback((color) => {
    setCurrentColor(color);
    setColorInput(color);
  }, []);

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
        <ToggleButtonGroup value={tool} exclusive onChange={handleToolChange} size="small">
          <ToggleButton value={TOOL_PEN}>Pincel</ToggleButton>
          <ToggleButton value={TOOL_ERASER}>Goma</ToggleButton>
          <ToggleButton value={TOOL_PICKER}>Cuentagotas</ToggleButton>
        </ToggleButtonGroup>
        <Button variant="outlined" size="small" onClick={clearPixels}>
          Limpiar lienzo
        </Button>
      </Stack>

      <Stack direction="row" spacing={2} alignItems="center">
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            component="input"
            type="color"
            value={colorInput}
            onChange={handleColorInputChange}
            sx={{ width: 40, height: 40, p: 0, border: 'none', background: 'none', cursor: 'pointer' }}
          />
          <Typography variant="body2" color="text.secondary">
            Color activo
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          {DEFAULT_COLORS.map((color) => (
            <Tooltip key={color} title={color} placement="top">
              <Box
                onClick={() => handlePaletteClick(color)}
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: 1,
                  border: color === currentColor ? '2px solid #fff' : '1px solid rgba(255,255,255,0.4)',
                  backgroundColor: color,
                  cursor: 'pointer'
                }}
              />
            </Tooltip>
          ))}
        </Stack>
      </Stack>

      <Box
        sx={{
          width: canvasSize,
          height: canvasSize,
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.2)',
          touchAction: 'none'
        }}
      >
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated' }}
        />
      </Box>

      <Divider>
        <Typography variant="caption" color="text.secondary">
          Vista previa
        </Typography>
      </Divider>

      <Stack direction="row" spacing={2} alignItems="center">
        <Box
          sx={{
            width: 96,
            height: 96,
            borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.12)',
            backgroundImage:
              'linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.1) 75%),\
 linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.1) 75%)',
            backgroundPosition: '0 0, 12px 12px',
            backgroundSize: '24px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <canvas
            width={gridSize}
            height={gridSize}
            style={{
              width: '88px',
              height: '88px',
              imageRendering: 'pixelated'
            }}
            ref={(previewCanvas) => {
              if (!previewCanvas) {
                return;
              }

              const context = previewCanvas.getContext('2d');

              if (!context) {
                return;
              }

              context.clearRect(0, 0, gridSize, gridSize);

              for (let y = 0; y < gridSize; y += 1) {
                for (let x = 0; x < gridSize; x += 1) {
                  const color = pixels[y][x];

                  if (!color) {
                    continue;
                  }

                  context.fillStyle = color;
                  context.fillRect(x, y, 1, 1);
                }
              }
            }}
          />
        </Box>
        <Typography variant="body2" color="text.secondary">
          Dibuja píxeles individuales para crear sprites sencillos. El lienzo exporta automáticamente un PNG de
          {` ${gridSize}×${gridSize} `}y actualiza los metadatos del asset.
        </Typography>
      </Stack>
    </Stack>
  );
}

