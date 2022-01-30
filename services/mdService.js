const fetch = require('node-fetch')

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random#getting_a_random_integer_between_two_values
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}

exports.getMangaIdsByLists = async (listsFilter) => {
    let mangaRefs = new Set()
    for (const list of listsFilter) {
        let listResponse = await fetch(`https://api.mangadex.org/list/${list}`)
        let listData = await listResponse.json()
        if (listData.result === "ok") {
            let temp = listData.data.relationships.filter(r => r.type === 'manga').map(m => m.id)
            for (const n of temp) mangaRefs.add(n)
        }
    }
    return Array.from(mangaRefs)
}

exports.getRandomChapter = async (mangaId) => {
    try {
        // initial /chapter call to see how many total chapters
        let chapterResponse = await fetch(`https://api.mangadex.org/chapter?translatedLanguage[]=en&limit=1&manga=${mangaId}`)
        let chapterData = await chapterResponse.json()
        let chapterTotal = chapterData.total
        if (chapterTotal === 0) {
            throw 'No chapter found'
        }
        let attempts = 0
        while (attempts < 5) {
            let rand = Math.floor(Math.random()*chapterTotal)
            chapterResponse = await fetch(`https://api.mangadex.org/chapter?translatedLanguage[]=en&limit=1&manga=${mangaId}&offset=${rand}`)
            chapterData = await chapterResponse.json()
            let chapter = chapterData.data[0]
            if (chapter.attributes.pages > 0) {
                return chapter.id
            }
            attempts++
        }
        throw 'No chapter found'
    } catch(e) {
        console.error(e)
        throw 'No chapter found'
    }
}

exports.getTitlesByIds = async (mangaIds) => {
    try {
        let idParams = '&ids[]=' + mangaIds.join('&ids[]=')
        let mangaResponse = await fetch(`https://api.mangadex.org/manga?limit=100${idParams}`)
        let mangaData = await mangaResponse.json()
        let titles = mangaData.data.map(m => ({
            'id': m.id,
            'titles': [ ...Object.values(m.attributes.title), ...m.attributes.altTitles.map(t => Object.values(t)[0]) ]
        }))
        return titles
    } catch(e) {
        throw e
    }
}

exports.getAllTitlesByIds = async (mangaIds, all) => {
    let listTitles = []
    let i, temp, chunk = 100
    for (i = 0; i < mangaIds.length; i += chunk) {
        temp = mangaIds.slice(i, i + chunk)
        let idParams = '&ids[]=' + temp.join('&ids[]=')
        let mangaResponse = await fetch(`https://api.mangadex.org/manga?limit=100${idParams}`)
        let mangaData = await mangaResponse.json()
        for (let m of mangaData.data) {
            let titles = Object.values(m.attributes.title)
            if (all) {
                let altTitles = m.attributes.altTitles
                    .map(t => Object.values(t)[0])           // get the values
                    .filter(t => /^[a-zA-Z0-9 !#$%&'()*+,-./:;<=>?@\[\]^_`|~¥°±²³½“”†•…₂←↑→↓⇆∀∅∇√△○●◯★☆♀♂♠♡♥♪♭❤￮]+$/.test(t)) // if it got funny letters not in this list, don't include
                    .slice(0, 2)                             // only first 3 values
                titles = titles.concat(altTitles)
            }
            listTitles = listTitles.concat(titles)
        }
    }
    return listTitles
}

exports.getPageLink = async (req, res) => {
    let { chapterId } = req.query
    console.log(`[GET /manga/pagelink] ${chapterId}`)
    try {
        let athomeUrlResponse = await fetch(`https://api.mangadex.org/at-home/server/${chapterId}`)
        let athomeUrlData = await athomeUrlResponse.json()
        let athomeUrl = ''
        let hash = ''
        let pageid = ''
        // in case of being ratelimited
        if (athomeUrlData.result === 'error' && athomeUrlData.errors[0].status === 429) {
            let retry = athomeUrlResponse.headers.get('retry-after')
            console.log('[GET /pagelink] RATE LIMITED')
            res.status(429).json({
                result: 'error',
                retry: parseInt(retry)
            })
        } else {
            athomeUrl = athomeUrlData.baseUrl
            hash = athomeUrlData.chapter.hash
            if (athomeUrlData.chapter.dataSaver.length > 2) {
                pageid = athomeUrlData.chapter.dataSaver[getRandomInt(1, athomeUrlData.chapter.dataSaver.length - 1)]
            } else {
                pageid = athomeUrlData.chapter.dataSaver[getRandomInt(0, athomeUrlData.chapter.dataSaver.length)]
            }
            res.status(200).json({
                result: 'ok',
                page: `${athomeUrl}/data-saver/${hash}/${pageid}`
            })
        }
    } catch(e) {
        console.error(e)
        res.status(500).json({
            result: 'error',
            page: ''
        })
    }
}