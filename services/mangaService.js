const { getMangaIdsByLists, getRandomChapter, getTitlesByIds } = require('./mdService')
const { Pool } = require('pg')
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
})

const validTags = ['Shounen','Shoujo','Seinen','Josei','Action','Adventure','Aliens','Animals','Boys\' Love','Comedy'
                  ,'Cooking','Crime','Delinquents','Demons','Drama','Fantasy','Genderswap','Ghosts','Girls\' Love'
                  ,'Gyaru','Harem','Historical','Horror','Isekai','Mafia','Magic','Magical Girls','Martial Arts'
                  ,'Mecha','Medical','Military','Monster Girls','Monsters','Music','Mystery','Ninja','Office Workers'
                  ,'Philosophical','Police','Post-Apocalyptic','Psychological','Reverse Harem','Romance','Samurai'
                  ,'School Life','Sci-Fi','Slice of Life','Sports','Superhero','Supernatural','Survival','Thriller'
                  ,'Time Travel','Tragedy','Vampires','Video Games','Villainess','Virtual Reality','Zombies']

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random#getting_a_random_integer_between_two_values
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}
                
exports.getMangaByTags = async (req, res) => {
    let { totalRounds, tags, minYear, maxYear, minRating, maxRating, minFollows } = req.query
    console.log(`[GET /manga/tags] total rounds: ${totalRounds} | tags: ${!tags ? 'None' : tags.join(', ')}`)
    try {
        let query
        minYear = minYear ? minYear : 0
        maxYear = maxYear ? maxYear : 9999
        minRating = minRating ? minYear : 0
        maxRating = maxRating ? maxYear : 99
        minFollows = minFollows ? minFollows : 0
        if (tags) {
            let tagsQuery = tags.filter(t => validTags.includes(t)).map(t => t.replace(/'/g, "''")).join(',')
            query = `SELECT id, valid_chapters, title, alt_titles FROM mangas JOIN tags ON mangas.id = tags.manga_id 
                     WHERE '{${tagsQuery}}'::tag[] && tags.tags 
                     AND year >= ${minYear}
                     AND year <= ${maxYear} 
                     AND rating >= ${minRating}
                     AND rating <= ${maxRating} 
                     AND follows >= ${minFollows} 
                     ORDER BY RANDOM() LIMIT ${totalRounds}`
        } else {
            query = `SELECT id, valid_chapters, title, alt_titles FROM mangas JOIN tags ON mangas.id = tags.manga_id WHERE year >= ${year} AND follows >= ${follows} AND rating >= ${rating} ORDER BY RANDOM() LIMIT ${totalRounds}`
        }
        let queryResult = await pool.query(query)
        if (queryResult.rows.length === 0) {
            res.status(400).json({
                'result': 'error',
                'mangas': []
            })
        } else {
            res.status(200).json({
                'result': 'ok',
                'mangas': queryResult.rows.map((q) => ({
                    'id': q.id,
                    'chapterId': q.valid_chapters[getRandomInt(0, q.valid_chapters.length)],
                    'titles': [ q.title, ...q.alt_titles ]
                }))
            })
        }
    } catch(e) {
        console.error(`[GET /manga/tags] ${e}`)
        res.status(500).json({
            'result': 'error',
            'mangas': []
        })
    }
}

exports.getMangaByLists = async (req, res) => {
    let { totalRounds, lists } = req.query
    console.log(`[GET /titles/lists] totalRounds: ${totalRounds} | lists: ${!lists ? 'None' : lists.join(', ')}`)
    if (!lists) {
        res.status(400).json({
            'result': 'error',
            'mangas': []
        })
    } else {
        let mangaIds = await getMangaIdsByLists(lists)
        if (mangaIds.length === 0) {
            res.status(400).json({
                'result': 'error',
                'mangas': []
            })
        } else {
            let mangasToSend = []
            let attempts = 0
            while (mangasToSend.length < totalRounds && attempts < totalRounds * 2) {
                try {
                    let mangaId = mangaIds[getRandomInt(0, mangaIds.length)]
                    let chapterId = await getRandomChapter(mangaId)
                    mangasToSend.push({
                        'id': mangaId,
                        'chapterId': chapterId
                    })
                    attempts++
                } catch {
                    attempts++
                }
            }
            if (mangasToSend.length > 0) {
                try {
                    let titlesGroupedByIds = await getTitlesByIds(mangasToSend.map(m => m.id))
                    mangasToSend = mangasToSend.map(m => ({
                        ...m,
                        'titles': titlesGroupedByIds.filter(t => t.id === m.id)[0].titles
                    }))
                    res.status(200).json({
                        'result': 'ok',
                        'mangas': mangasToSend
                    })
                } catch(e) {
                    console.error(e)
                    res.status(500).json({
                        'result': 'error',
                        'mangas': []
                    })
                }
            } else {
                res.status(400).json({
                    'result': 'error',
                    'mangas': []
                })
            }
        }
    }
}

exports.getStatistics = async (req, res) => {
    // returns most played, most correct, most incorrect
    console.log(`[GET /manga/statistics]`)
    try {
        let query = `(SELECT id, title, cover, total_plays, times_correct, percent_correct FROM scores JOIN mangas ON scores.manga_id = mangas.id ORDER BY total_plays DESC LIMIT 3)
                     UNION ALL
                     (SELECT id, title, cover, total_plays, times_correct, percent_correct FROM scores JOIN mangas ON scores.manga_id = mangas.id ORDER BY percent_correct DESC LIMIT 3)
                     UNION ALL
                     (SELECT id, title, cover, total_plays, times_correct, percent_correct FROM scores JOIN mangas ON scores.manga_id = mangas.id ORDER BY percent_correct ASC LIMIT 3)`
        let queryResult = await pool.query(query)
        res.status(200).json({
            'result': 'ok',
            'statistics': [
                queryResult.rows.slice(0,3),
                queryResult.rows.slice(3,6),
                queryResult.rows.slice(6,9)
            ]
        })
    } catch {
        res.status(500).json({
            'result': 'error',
            'statistics': []
        })
    }
}

exports.updateScore = async (req, res) => {
    let { id, correct } = req.body
    console.log(`[POST /manga/score}] id: ${id} | correct: ${correct}`)
    if (!id || correct === undefined) {
        res.status(400).json({
            'result': 'error'
        })
    } else {
        try {
            let query = `INSERT INTO scores VALUES ('${id}', 1, ${correct ? 1 : 0}, ${correct ? 1 : 0}) ON CONFLICT (manga_id) DO UPDATE SET total_plays = scores.total_plays + 1, times_correct = scores.times_correct + excluded.times_correct,
                                                                                                                                             percent_correct = (scores.times_correct + excluded.times_correct)::decimal/(scores.total_plays + 1)`
            await pool.query(query)
            res.status(200).json({
                'result': 'ok'
            })
        } catch(e) {
            console.error(e)
            res.status(500).json({
                'result': 'error'
            })
        }

    }
}