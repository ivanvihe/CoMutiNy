# QA visual para CoMutiNy

Este checklist garantiza la calidad de las escenas isométricas antes de fusionar cambios.

## 1. Inspección manual

1. Abre `/world` con datos de prueba y revisa el canvas.
2. Comprueba que las capas superiores (`mode: overlay`) no oculten al jugador salvo en áreas esperadas (p. ej. copas de árboles).
3. Valida que los objetos sólidos respeten su volumen y proyecten sombras coherentes.
4. Captura una imagen de referencia cuando se introduzcan assets nuevos.

## 2. Atributos de diagnóstico

`MapViewport` expone métricas en el canvas (`.map-viewport__canvas`):

- `data-layer-count`: total de capas de tiles activas.
- `data-overlay-count`: capas marcadas como `overlay`.
- `data-solid-count`: objetos con colisión en el mapa actual.
- `data-max-volume-height`: altura máxima (en tiles) registrada por los objetos.

Asegúrate de que:

1. `data-layer-count` sea ≥ 2 cuando exista overlay.
2. `data-overlay-count` coincida con el número de capas configuradas en el mapa.
3. `data-max-volume-height` refleje la altura esperada de los prototipos (torres, plataformas).

## 3. Pruebas automatizadas

Ejecuta Playwright para validar la escena base y el dataset de diagnóstico:

```bash
npx playwright test client/tests/e2e/map-visual.spec.js
```

La prueba verifica:

- Carga del mapa con capas múltiples y overlay.
- Presencia de objetos sólidos con alturas distintas.
- Exposición de los atributos `data-*` descritos arriba.

## 4. Revisión de assets

1. Confirma que nuevos tiles y objetos estén documentados en `docs/assets/tile-object-catalog.md`.
2. Revisa que los generadores de sprites tengan capas auxiliares (sombras/lights) cuando proceda.
3. Comprueba que el pipeline (`docs/assets/pipeline.md`) se haya seguido y que existan capturas adjuntas en la PR.

## 5. Reporte

Documenta los resultados de QA en la PR indicando:

- Salida de Playwright (`map-visual.spec.js`).
- Cambios relevantes en `data-max-volume-height` si se introducen nuevas alturas.
- Evidencia visual (capturas o GIF) para superposiciones críticas.

## 6. Etiquetas y chat

1. Ajusta los offsets globales en `client/src/config/ui.js` y recarga la vista. Confirma que las etiquetas de nombre se reposicionan sin cortar sprites.
2. Conecta al menos dos perfiles simultáneos. Envía mensajes consecutivos en distintos idiomas (español, inglés y uno sin espacios como japonés usando «テスト») para comprobar que:
   - Cada burbuja aparece junto al nombre correspondiente durante ~2,5 s antes de volver al nombre estático.
   - Los mensajes se envuelven o se truncan con elipsis sin desbordar el canvas.
3. Repite la prueba con mensajes largos encadenados por varios jugadores para validar que múltiples burbujas coexisten sin superponerse con etiquetas ajenas.
4. Anota en la PR el resultado de esta verificación visual, incluyendo capturas si se ajustaron offsets personalizados por jugador.
