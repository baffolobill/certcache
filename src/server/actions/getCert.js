const md5 = require('md5')
const tar = require('tar')
const getLocalCertificates = require('../../helpers/getLocalCertificates')
const util = require('util')
const fs = require('fs')
const arrayItemsMatch = require('../../helpers/arrayItemsMatch')
const uuid = require('uuid')
const generateCert = require('../../helpers/generateCert')
const fileExists = require('../../helpers/fileExists')

const readFile = util.promisify(fs.readFile)
const unlink = util.promisify(fs.unlink)
const mkdir = util.promisify(fs.mkdir)
const readdir = util.promisify(fs.readdir)

const findCert = (cachedCertificates, commonName, altNames, isTest) =>
  cachedCertificates.find(
    ({
      subject: {commonName: certCommonName},
      altNames: certAltNames,
      issuer: {commonName: issuerCommonName}
    }) => {
      const certIsTest = (issuerCommonName.indexOf('Fake') !== -1)

      return (
        certIsTest === isTest &&
        certCommonName === commonName &&
        arrayItemsMatch(certAltNames, altNames)
      )
    }
  )

module.exports = async (payload) => {
  const {isTest, domains} = payload
  const [commonName, ...altNames] = domains
  altNames.push(commonName)
  const letsEncryptConfigDir = process.env.CERTCACHE_LETSENCRYPT_CONFIG_DIR ||
    __dirname + '/../../../letsencrypt/config/'
  const cachedCertificates = await getLocalCertificates(`${letsEncryptConfigDir}/live/`)
  const cachedCert = findCert(cachedCertificates, commonName, altNames, isTest)
  const tmpDir = process.env.CERTCACHE_TMP_DIR || '/tmp/certcache/'
  const tarPath = `${tmpDir}/${uuid()}`

  if (await fileExists(tmpDir) === false) {
    await mkdir(tmpDir, {recurse: true})
  }

  const certPath = (cachedCert !== undefined)
    ? cachedCert.certPath
    : (await generateCert(commonName, altNames, isTest))
  const files = (await readdir(certPath))
    .filter((file) => file.indexOf('.pem') !== -1)
  await tar.c(
    {file: tarPath, gzip: true, cwd: certPath, follow: true},
    files
  )
  const buffer = await readFile(tarPath)
  await unlink(tarPath)

  return {bundle: buffer.toString('base64')}
}
