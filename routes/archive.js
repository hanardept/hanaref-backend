// File: hanaref-backend/routes/archive.js

const router = require('express').Router();
const Item = require('../models/item');
const { verifyToken } = require('../verifyToken'); // We will use your existing auth check

// This endpoint will handle toggling the 'archived' status.
// It will be accessed via: POST /api/items/:id/toggle-archive
router.post('/:id/toggle-archive', verifyToken, async (req, res) => {
  // Because of `verifyToken`, we know `req.user` exists if we reach this point.
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).send('Item not found.');
    }

    // This is the core logic: it flips the boolean value.
    item.archived = !item.archived;
    await item.save();

    // Send the updated item back to the frontend to confirm the change.
    res.status(200).json(item);

  } catch (error) {
    console.error(`Error toggling archive for item ${req.params.id}:`, error);
    res.status(500).send('A server error occurred.');
  }
});

module.exports = router;
