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

exports.getTitles = async (req, res) => {
    console.log('[GET /titles]')
    let query = 'SELECT title FROM titles ORDER BY title'
    try {
        let queryResult = await pool.query(query)
        res.status(200).json({
            'result': 'ok',
            'titles': queryResult.rows.map(i => i.title)
        })
    } catch (e) {
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
            query = `SELECT title FROM titles JOIN tags ON titles.manga_id = tags.manga_id WHERE '{${tags.filter(t => validTags.includes(t)).map(t => t.replace(/'/g, "''")).join(',')}}'::tag[] && tags.tags ORDER BY title`
        } else {
            query = 'SELECT title FROM titles ORDER BY title'
        }
        let queryResult = await pool.query(query)
        res.status(200).json({
            'result': 'ok',
            'titles': queryResult.rows.map(i => i.title)
        })
    } catch (e) {
        res.status(500).json({
            'result': 'error',
            'titles': []
        })
    }
}

exports.getTitlesByLists = async (req, res) => {
    let { lists } = req.query
    console.log(`[GET /titles/lists] lists: ${!lists ? 'None' : lists.join(', ')}`)
    res.status(200).json({
        'result': 'ok',
        'titles': lists
    })
}