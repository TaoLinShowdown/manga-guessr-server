const express = require('express')
const cors = require('cors')
const fetch = require('node-fetch');
const mangas = require('./mangas.json')

Object.filter = (obj, predicate) => 
                    Object.fromEntries(Object.entries(obj).filter(predicate));

function getFilteredMangasByTags(tagsFilter, year=0) {
    if (tagsFilter.length === 0) {
        return mangas
    }
    let filtered = Object.filter(mangas, ([ref, { titles, tags }]) => tags.some(t => tagsFilter.indexOf(t) >= 0))
    return filtered
}

async function getFilteredMangasByLists(listsFilter, year=0) {
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

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random#getting_a_random_integer_between_two_values
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}

// express app
const app = express()
const port = process.env.PORT || 80
app.use(express.json())
app.use(cors())

// get a list of manga based on tags
app.post('/manga/tags', async function(req, res) {
    let { totalRounds, tags } = req.body
    console.log(`[POST /manga/tags] totalRounds: ${totalRounds} | tags: ${tags.join(', ')}`)
    
    let filteredMangas = getFilteredMangasByTags(tags)
    if (Object.keys(filteredMangas).length === 0) {
        res.status(400).json({
            'result': 'error',
            'mangas': []
        })
    } else {
        let mangasToSend = []
        while (mangasToSend.length < totalRounds) {
            let manga, chapters = {}
            let ref = ''
            let chapterTotal = 0
            while (chapterTotal === 0) {
                let refs = Object.keys(filteredMangas)
                ref = refs[refs.length*Math.random() << 0]
                let chapterResponse = await fetch(`https://api.mangadex.org/chapter?translatedLanguage[]=en&limit=1&manga=${ref}`)
                chapters = await chapterResponse.json()
                chapterTotal = chapters.total
                if (chapterTotal === 0) {
                    console.log(`This manga has no chapters. Ref: ${ref}`)
                } else {
                    manga = mangas[ref]
            
                    // get a random chapter
                    let randomChapterN = Math.floor(Math.random() * chapterTotal)
                    let chapterResponse = await fetch(`https://api.mangadex.org/chapter?translatedLanguage[]=en&limit=1&offset=${randomChapterN}&manga=${ref}`)
                    let chapterData = await chapterResponse.json()
                    let attempts = 0

                    // if the number of pages in the chapter is 0, try to get a new chapter 5 times
                    while (chapterData.data[0].attributes.pages === 0 && attempts < 5) {
                        randomChapterN = Math.floor(Math.random() * chapterTotal)
                        chapterResponse = await fetch(`https://api.mangadex.org/chapter?translatedLanguage[]=en&limit=1&offset=${randomChapterN}&manga=${ref}`)
                        chapterData = await chapterResponse.json()
                        attempts++
                    }

                    // if the page count is still 0, get a new manga
                    if (chapterData.data[0].attributes.pages === 0) {
                        chapterTotal = 0
                    } else {
                        let chapter = chapterData.data[0]
                
                        mangasToSend.push({
                            'titles': manga.titles,
                            'chapterid': chapter.id,
                            'ref': ref
                        })
                    }
                }
            }
        }
    
        res.status(200).json({
            'result': 'ok',
            'mangas': mangasToSend
        })
    }
})

// get a list of manga based on MDLists
app.post('/manga/lists', async function(req, res) {
    let { totalRounds, lists } = req.body
    console.log(`[POST /manga/lists] totalRounds: ${totalRounds} | lists: ${lists.join(', ')}`)

    if (lists.length === 0) {
        res.status(400).json({
            'result': 'error',
            'mangas': []
        })
    } else {
        let filteredMangaRefs = await getFilteredMangasByLists(lists)
        if (filteredMangaRefs.length === 0) {
            res.status(400).json({
                'result': 'error',
                'mangas': []
            })
        } else {
            let mangasToSend = []
            while (mangasToSend.length < totalRounds) {
                let chapters = {}
                let ref = ''
                let chapterTotal = 0
                let attempts = 0
                while (chapterTotal === 0 && attempts < totalRounds * 3) {
                    attempts++
                    ref = filteredMangaRefs[Math.floor(Math.random() * filteredMangaRefs.length)]
                    let chapterResponse = await fetch(`https://api.mangadex.org/chapter?translatedLanguage[]=en&limit=1&manga=${ref}`)
                    chapters = await chapterResponse.json()
                    chapterTotal = chapters.total
                    if (chapterTotal === 0) {
                        console.log(`This manga has no chapters. Ref: ${ref}`)
                    } else {
                        // get a random chapter
                        let randomChapterN = Math.floor(Math.random() * chapterTotal)
                        let chapterResponse = await fetch(`https://api.mangadex.org/chapter?translatedLanguage[]=en&limit=1&offset=${randomChapterN}&manga=${ref}`)
                        let chapterData = await chapterResponse.json()
                        let pageAttempts = 0

                        // if the number of pages in the chapter is 0, try to get a new chapter 5 times
                        while (chapterData.data[0].attributes.pages === 0 && pageAttempts < 5) {
                            randomChapterN = Math.floor(Math.random() * chapterTotal)
                            chapterResponse = await fetch(`https://api.mangadex.org/chapter?translatedLanguage[]=en&limit=1&offset=${randomChapterN}&manga=${ref}`)
                            chapterData = await chapterResponse.json()
                            pageAttempts++
                        }

                        // if the page count is still 0, get a new manga
                        if (chapterData.data[0].attributes.pages === 0) {
                            chapterTotal = 0
                        } else {
                            let chapter = chapterData.data[0]
                            
                            // get the titles for the manga
                            let mangaResponse = await fetch(`https://api.mangadex.org/manga/${ref}`)
                            let mangaData = await mangaResponse.json()
                            let titles = []
                            for (const t in mangaData.data.attributes.title) {
                                if (t === 'en') titles.push(mangaData.data.attributes.title[t])
                            }
                            titles = titles.concat(mangaData.data.attributes.altTitles.filter(t => Object.keys(t)[0] === 'en').map(t => Object.values(t)[0]))

                            mangasToSend.push({
                                'titles': titles,
                                'chapterid': chapter.id,
                                'ref': ref
                            })
                        }
                    }
                }
                if (attempts === totalRounds * 3) {
                    break
                }
            }
            if (mangasToSend.length === 0) {
                res.status(400).json({
                    'result': 'error - ran out of attempts',
                    'mangas': mangasToSend
                })
            } else {
                res.status(200).json({
                    'result': 'ok',
                    'mangas': mangasToSend
                })
            }
        }
    }
})

app.get('/titles', function(req, res) { // called when using autocomplete
    console.log(`[GET /titles]`)
    let titles = new Set()
    for (var key in mangas) {
        m = mangas[key]
        m.titles.forEach(t => {
            titles.add(t.trim())
        })
    }
    res.status(200).send(Array.from(titles).sort())
})

app.post('/titles/tags', function(req, res) { // called when using multiple choice and tags
    let { tags } = req.body
    console.log(`[POST /titles] tags: ${tags.join(', ')}`)
    let titles = new Set()
    let filteredMangas = getFilteredMangasByTags(tags)
    for (var key in filteredMangas) {
        m = filteredMangas[key]
        m.titles.forEach(t => {
            titles.add(t.trim())
        })
    }
    res.status(200).send(Array.from(titles))
})

app.post('/titles/lists', async function(req, res) { // called when using multiple choice and mdlists
    let { lists } = req.body
    console.log(`[POST /titles] lists: ${lists.join(', ')}`)
    let listTitles = []
    let refs = await getFilteredMangasByLists(lists)
    for (let ref of refs) {
        let mangaResponse = await fetch(`https://api.mangadex.org/manga/${ref}`)
        let mangaData = await mangaResponse.json()
        let titles = []
        for (const t in mangaData.data.attributes.title) {
            titles.push(mangaData.data.attributes.title[t])
        }
        let altTitles = mangaData.data.attributes.altTitles.filter(t => Object.keys(t)[0] === 'en').map(t => Object.values(t)[0])
        titles = titles.concat(altTitles.filter(t => /^[a-zA-Z0-9 !#$%&'()*+,-./:;<=>?@\[\]^_`|~¥°±²³½“”†•…₂←↑→↓⇆∀∅∇√△○●◯★☆♀♂♠♡♥♪♭❤￮]+$/.test(t)))
        listTitles = listTitles.concat(titles)
    }

    res.status(200).send(listTitles)
})

app.get('/pagelink', async function(req, res) {
    console.log('[GET /pagelink]')
    let { chapterId } = req.query
    let athomeUrlResponse = await fetch(`https://api.mangadex.org/at-home/server/${chapterId}`, {
        mode: 'no-cors'
    })
    let athomeUrlData = await athomeUrlResponse.json()
    let athomeUrl = ''
    let hash = ''
    let pageid = ''

    // in case of being ratelimited
    if (athomeUrlData.result === 'error' && athomeUrlData.errors[0].status === 429) {
        let retry = athomeUrlResponse.headers.get('retry-after')
        console.log('[ERROR /pagelink] RATE LIMITED')
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

})

app.listen(port, () => console.log(`Listening on ${ port }`))