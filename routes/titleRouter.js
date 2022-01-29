const titleService = require('../services/titleService')
const express = require('express');
const router = express.Router()
router.get('/', titleService.getTitles)
router.get('/tags', titleService.getTitlesByTags)
router.get('/lists', titleService.getTitlesByLists)
module.exports = router