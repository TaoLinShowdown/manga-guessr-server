const { getMangaIdsByLists, getAllTitlesByIds } = require('./mdService')
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

function groupTitles (titles) {
    let list = {}
    for (let t of titles) {
        if (t.id in list) {
            list[t.id].push(t.title)
        } else {
            list[t.id] = [ t.title ]
        }
    }
    return list
}

exports.getTitles = async (req, res) => {
    console.log('[GET /titles]')
    try {
        let query = 'SELECT title, alt_titles FROM mangas'
        let queryResult = await pool.query(query)
        let titles = queryResult.rows.reduce((list, q) => list.concat([ q.title, ...q.alt_titles ]), []).sort()
        res.status(200).json({
            'result': 'ok',
            'titles': titles
        })
    } catch (e) {
        console.error(e)
        res.status(500).json({
            'result': 'error',
            'titles': []
        })
    }
}

exports.getTitlesByTags = async (req, res) => {
    let { tags } = req.query
    console.log(`[GET /titles/tags] tags: ${!tags ? 'None' : tags.join(', ')}`)
    try {
        let query
        if (tags) {
            query = `SELECT title FROM mangas JOIN tags ON id = tags.manga_id WHERE '{${tags.filter(t => validTags.includes(t)).map(t => t.replace(/'/g, "''")).join(',')}}'::tag[] && tags.tags`
        } else {
            query = 'SELECT title FROM mangas'
        }
        let queryResult = await pool.query(query)
        res.status(200).json({
            'result': 'ok',
            'titles': queryResult.rows.map(q => q.title)
        })
    } catch (e) {
        res.status(500).json({
            'result': 'error',
            'titles': []
        })
    }
}

exports.getTitlesByLists = async (req, res) => {
    async function sendAllTitles() {
        let query = 'SELECT manga_id as id, title FROM titles'
        try {
            let queryResult = await pool.query(query)
            res.status(200).json({
                'result': 'ok',
                'titles': queryResult.rows.map(q => q.title)
            })
        } catch (e) {
            res.status(500).json({
                'result': 'error',
                'titles': []
            })
        }
    }

    let { lists, all } = req.query
    console.log(`[GET /titles/lists] lists: ${!lists ? 'None' : lists.join(', ')}`)
    if (!lists) {
        sendAllTitles()
    } else {
        try {
            let ids = await getMangaIdsByLists(lists)
            let titles = await getAllTitlesByIds(ids, all === '1')
            res.status(200).json({
                'result': 'ok',
                'titles': titles
            })
        } catch(e) {
            console.error(e)
            sendAllTitles()
        }
    }
}