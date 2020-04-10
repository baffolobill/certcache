const getLocalCertificates = require('../getLocalCertificates')
const getConfig = require('../getConfig')
const httpRedirect = require('../httpRedirect')
const normaliseCertDefinitions = require('./normaliseCertDefinitions')
const obtainCert = require('./obtainCert')
const path = require('path')
const debug = require('debug')('certcache:syncCerts')
const copyCert = require('../helpers/copyCert')
const fileExists = require('../helpers/fileExists')
const getMetaFromCert =
  require('../getMetaFromBackendFunction')('getMetaFromCert')
const getMetaFromCertDefinition =
  require('../getMetaFromBackendFunction')('getMetaFromCertDefinition')

module.exports = async () => {
  const config = (await getConfig())
  const {
    certDir,
    certs,
    httpRedirectUrl,
    host,
    port,
    renewalDays
  } = config.client
  const certcacheCertDir = path.resolve(certDir)
  const localCerts = await getLocalCertificates(certcacheCertDir)
  const certRenewEpoch = new Date()

  certRenewEpoch.setDate(certRenewEpoch.getDate() + renewalDays)

  const certsForRenewal = localCerts
    .filter(({ notAfter }) => (notAfter.getTime() < certRenewEpoch.getTime()))

  const certDefinitions = normaliseCertDefinitions(certs)
  const certDefinitionsFileExistsSearch = (await Promise.all(certDefinitions.map(
    ({ certName }) => fileExists(path.resolve(certDir, certName))
  )))
  const certDefinitionsNotOnFs = certDefinitions.filter((_, i) => (
    certDefinitionsFileExistsSearch[i] === false
  ))
  debug('Searching for local certs in', certcacheCertDir)
  const certsToCopyWhenReceived = []

  const certDefinitionsForRenewal = await Promise.all(
    certDefinitionsNotOnFs.map(async (configDomain) => ({
      commonName: configDomain.domains[0],
      altnames: configDomain.domains,
      meta: await getMetaFromCertDefinition(configDomain),
      certDir: path.resolve(certDir, configDomain.certName)
    }))
  )

  if (httpRedirectUrl !== undefined) {
    httpRedirect.start(httpRedirectUrl)
  }

  const certsToRequest = [
    ...certDefinitionsForRenewal,
    ...await Promise.all(certsForRenewal.map(async (cert) => ({
      ...cert,
      certDir: path.dirname(cert.certPath),
      meta: await getMetaFromCert(cert)
    })))
  ]

  const obtainCertErrors = []

  await Promise.all(
    certsToRequest.map(async ({ altNames, certDir, commonName, meta }) => {
      try {
        await obtainCert(
          host,
          port,
          commonName,
          altNames,
          meta,
          certDir,
          { cahKeysDir: config.cahKeysDir, days: renewalDays }
        )
      } catch (e) {
        obtainCertErrors.push(e.message)
      }
    })
  )

  if (httpRedirectUrl !== undefined) {
    httpRedirect.stop()
  }

  await Promise.all(certsToCopyWhenReceived.map(([fromDir, toDir]) => {
    return copyCert(fromDir, toDir)
  }))

  const numRequested = certsForRenewal.length + certDefinitionsForRenewal.length
  const numTotal = localCerts.length + certDefinitionsForRenewal.length
  const numFailed = obtainCertErrors.length
  const msg = [
    numTotal,
    'certs:',
    numRequested,
    'requested.',
    numRequested - numFailed,
    'transfered.',
    numFailed,
    'failed.'
  ]

  console.log(msg.join(' '))

  if (obtainCertErrors.length !== 0) {
    throw new Error(obtainCertErrors.join('\n'))
  }
}
