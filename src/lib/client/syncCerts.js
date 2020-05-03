const getLocalCertificates = require('../getLocalCertificates')
const getConfig = require('../getConfig')
const httpRedirect = require('../httpRedirect')
const normaliseCertDefinitions = require('./normaliseCertDefinitions')
const obtainCert = require('./obtainCert')
const path = require('path')
const debug = require('debug')('certcache:syncCerts')
const getMetaFromCert =
  require('../getMetaFromExtensionFunction')('getMetaFromCert')
const getMetaFromCertDefinition =
  require('../getMetaFromExtensionFunction')('getMetaFromCertDefinition')
const normaliseUpstreamConfig = require('../normaliseUpstreamConfig')
const arrayItemsMatch = require('../helpers/arrayItemsMatch')
const filterAsync = require('../helpers/filterAsync')
const someAsync = require('../helpers/someAsync')
const metaItemsMatch = require('../helpers/metaItemsMatch')

module.exports = async () => {
  const config = (await getConfig())
  const {
    certDir,
    certs,
    httpRedirectUrl,
    renewalDays,
    upstream
  } = config
  const certcacheCertDir = path.resolve(certDir)
  const localCerts = await getLocalCertificates(certcacheCertDir)
  const certRenewEpoch = new Date()
  const { host, port } = normaliseUpstreamConfig(upstream)

  certRenewEpoch.setDate(certRenewEpoch.getDate() + renewalDays)

  const certDefinitions = normaliseCertDefinitions(certs)
  const certDefinitionsToRenew = await filterAsync(
    certDefinitions,
    async (certDefinition, i) => (
      await someAsync(
        localCerts,
        async (cert) => {
          const { certPath, commonName, altNames = [] } = cert

          return (
            path.basename(path.dirname(certPath)) === certDefinition.certName &&
            commonName === certDefinition.domains[0] &&
            (
              arrayItemsMatch(altNames, certDefinition.domains) ||
              (altNames.length === 0 && certDefinition.domains.length === 1)
            ) &&
            metaItemsMatch(
              await getMetaFromCert(cert),
              await getMetaFromCertDefinition(certDefinition)
            )
          )
        }
      ) === false
    )
  )

  debug('Searching for local certs in', certcacheCertDir)

  const certDefinitionsForRenewal = await Promise.all(
    certDefinitionsToRenew.map(async (certDefinition) => ({
      commonName: certDefinition.domains[0],
      altNames: certDefinition.domains,
      meta: await getMetaFromCertDefinition(certDefinition),
      certDir: path.resolve(certDir, certDefinition.certName)
    }))
  )

  const certsForRenewal = localCerts.filter(({ certPath, notAfter }) => (
    notAfter.getTime() < certRenewEpoch.getTime() &&
    certDefinitionsForRenewal.some(
      ({ certDir }) => (path.dirname(certPath) === certDir)
    ) === false
  ))

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
