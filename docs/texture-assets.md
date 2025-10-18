# Texture Asset Sources

Los bloques del mundo vóxel necesitan texturas PBR que se sirven desde `frontend/public/textures/pbr`. No incluimos estos binarios en el repositorio; descárgalos manualmente y colócalos en las carpetas indicadas a continuación.

Todas las texturas sugeridas a continuación están publicadas bajo licencia CC0. Puedes sustituirlas por otras si lo prefieres, siempre que respetes la convención de nombres.

## Ubicación de destino

Guarda los archivos en las siguientes rutas relativas a la raíz del proyecto:

```
frontend/public/textures/pbr/<material>/<material>_<mapa>.png
```

Por ejemplo, la textura de color (albedo) para la piedra debe guardarse como `frontend/public/textures/pbr/stone/stone_albedo.png`.

Cada material utiliza los mapas:

- `albedo`
- `normal`
- `roughness`
- `metallic`
- `ao` (ambient occlusion)

## Fuentes recomendadas

| Material | Paquete recomendado | URL de descarga (PNG 2K) |
| --- | --- | --- |
| Hierba (`grass`) | **ambientCG – Grass001** | https://ambientcg.com/get?file=Grass001_2K-PNG.zip |
| Hierba superior (`grass_top`) | **ambientCG – GrassPatch001** | https://ambientcg.com/get?file=GrassPatch001_2K-PNG.zip |
| Tierra (`dirt`) | **ambientCG – Soil001** | https://ambientcg.com/get?file=Soil001_2K-PNG.zip |
| Arena (`sand`) | **ambientCG – Sand001** | https://ambientcg.com/get?file=Sand001_2K-PNG.zip |
| Piedra (`stone`) | **ambientCG – Rock048** | https://ambientcg.com/get?file=Rock048_2K-PNG.zip |
| Agua (`water`) | **ambientCG – Water013** | https://ambientcg.com/get?file=Water013_2K-PNG.zip |

## Pasos para preparar las texturas

1. Descarga cada archivo ZIP desde los enlaces anteriores.
2. Extrae los mapas `COLOR`, `NORMAL`, `ROUGHNESS`, `METALNESS` y `AO`. Renómbralos para que coincidan con el esquema `*_albedo.png`, `*_normal.png`, `*_roughness.png`, `*_metallic.png` y `*_ao.png`.
3. Copia los archivos renombrados en la carpeta de su material correspondiente (por ejemplo, todos los mapas de piedra en `frontend/public/textures/pbr/stone/`).
4. Reinicia el servidor de desarrollo si estaba en ejecución para que Babylon.js recargue las texturas.

> **Nota:** Si quieres automatizar el proceso, puedes escribir un script que descargue y renombre los archivos usando las mismas URLs. Mantuvimos las instrucciones manuales para evitar dependencias adicionales.
