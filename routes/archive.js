// File: hanaref-backend/routes/archive.js

const router = require('express').Router();
const Item = require('../models/item'); // Uses the correct path to your model

// This endpoint will handle toggling the 'archived' status of an item.
// It will be accessed via: POST /api/items/:id/toggle-archive
router.post('/:id/toggle-archive', async (req, res) => {
  // NOTE: This assumes your authentication middleware adds a 'user' object
  // to the request for logged-in users. If not, we can adjust.
  if (!req.user) {
    return res.status(401).send('Authentication is required for this action.');
  }

  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).send('Item not found.');
    }

    // This is the core logic: it flips the boolean value.
    item.archived = !item.archived;
    await item.save();

    // We send the updated item back to the frontend.
    res.status(200).json(item);

  } catch (error) {
    console.error('Error toggling archive status for item:', req.params.id, error);
    res.status(500).send('A server error occurred.');
  }
});

module.exports = router;
