const clientAuthenticatedHttps = require('client-authenticated-https')
const actions = require('./actions')
const getConfig = require('../getConfig')
const createRequestHandler = require('./createRequestHandler')

module.exports = async () => {
  const config = (await getConfig())
  const server = await clientAuthenticatedHttps.createServer(
    { cahKeysDir: config.cahKeysDir },
    createRequestHandler({ actions })
  )

  server.listen(config.server.port)
}
