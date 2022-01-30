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
    let { totalRounds, tags, year, follows, rating } = req.query
    console.log(`[GET /manga/tags] total rounds: ${totalRounds} | tags: ${!tags ? 'None' : tags.join(', ')}`)
    try {
        let query
        year = year ? year : 0
        follows = follows ? follows : 0
        rating = rating ? rating : 0
        if (tags) {
            let tagsQuery = tags.filter(t => validTags.includes(t)).map(t => t.replace(/'/g, "''")).join(',')
            query = `SELECT id, validChapters FROM mangas JOIN tags ON mangas.id = tags.manga_id WHERE '{${tagsQuery}}'::tag[] && tags.tags AND year >= ${year} AND follows >= ${follows} AND rating >= ${rating} ORDER BY RANDOM() LIMIT ${totalRounds}`
        } else {
            query = `SELECT id, validChapters FROM mangas JOIN tags ON mangas.id = tags.manga_id WHERE year >= ${year} AND follows >= ${follows} AND rating >= ${rating} ORDER BY RANDOM() LIMIT ${totalRounds}`
        }
        let queryResult = await pool.query(query)
        if (queryResult.rows.length === 0) {
            res.status(400).json({
                'result': 'error',
                'mangas': []
            })
        } else {
            let mangaIds = queryResult.rows.map(q => `'${q.id}'`)
            let titleQuery = `SELECT * FROM titles WHERE manga_id in (${mangaIds.join(',')})`
            let titleQueryResult = await pool.query(titleQuery)
            res.status(200).json({
                'result': 'ok',
                'mangas': queryResult.rows.map((q) => ({
                    'id': q.id,
                    'chapterId': q.validchapters[getRandomInt(0, q.validchapters.length)],
                    'titles': titleQueryResult.rows.filter(t => t.manga_id === q.id).map(t => t.title)
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