const mangaService = require('../services/mangaService')
const express = require('express');
const router = express.Router()
router.get('/tags', mangaService.getMangaByTags)
router.get('/lists', mangaService.getMangaByLists)
module.exports = router