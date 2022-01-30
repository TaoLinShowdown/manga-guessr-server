const mangaService = require('../services/mangaService')
const mdService = require('../services/mdService')
const express = require('express');
const router = express.Router()
router.get('/tags', mangaService.getMangaByTags)
router.get('/lists', mangaService.getMangaByLists)
router.get('/pagelink', mdService.getPageLink)
router.get('/statistics', mangaService.getStatistics)
router.post('/score', mangaService.updateScore)
module.exports = router