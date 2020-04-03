const path = require('path')
const getConfig = require('../getConfig')
const httpRedirect = require('../httpRedirect')
const obtainCert = require('./obtainCert')
const getMetaFromConfig =
  require('../getMetaFromBackendFunction')('getMetaFromConfig')

module.exports = async (opts) => {
  const config = (await getConfig())
  const {
    certDir,
    host,
    port,
    httpRedirectUrl,
    renewalDays
  } = config.client
  const domains = opts.domains.split(',')
  const [commonName, ...altNames] = domains
  const certName = opts['cert-name'] || commonName
  const meta = await getMetaFromConfig(config)

  if (httpRedirectUrl !== undefined) {
    httpRedirect.start(httpRedirectUrl)
  }

  await obtainCert(
    host,
    port,
    commonName,
    altNames,
    meta,
    path.resolve(certDir, certName),
    { cahKeysDir: opts.cahkeys, days: renewalDays }
  )

  if (httpRedirectUrl !== undefined) {
    httpRedirect.stop()
  }
}
