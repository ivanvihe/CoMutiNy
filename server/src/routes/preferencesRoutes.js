import { Router } from 'express';
import playerPreferencesService from '../services/playerPreferencesService.js';

const router = Router();

router.get('/:alias', async (req, res, next) => {
  try {
    const preferences = await playerPreferencesService.getPreferences(req.params.alias);
    res.json({ preferences });
  } catch (error) {
    next(error);
  }
});

router.put('/:alias', async (req, res, next) => {
  try {
    const preferences = await playerPreferencesService.updatePreferences(req.params.alias, req.body);
    res.json({ preferences });
  } catch (error) {
    if (error?.message && error.message.includes('Alias inválido')) {
      res.status(400).json({ message: error.message });
      return;
    }
    next(error);
  }
});

export default router;
