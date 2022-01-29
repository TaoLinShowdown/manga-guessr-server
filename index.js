const express = require('express')
const cors = require('cors')
const mangaRouter = require('./routes/mangaRouter')
const titleRouter = require('./routes/titleRouter')

const app = express()
const port = process.env.PORT || 80
app.use(express.json())
app.use(cors())
app.use('/manga', mangaRouter)
app.use('/titles', titleRouter)

app.listen(port, () => console.log(`Listening on ${ port }`))