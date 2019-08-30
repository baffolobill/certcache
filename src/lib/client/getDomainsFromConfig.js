module.exports = (domainsConfig) => {
  return domainsConfig.map((item) => {
    if (typeof item === 'string') {
      item = item.split(',')
    }

    if (Array.isArray(item)) {
      item = {
        certName: item[0],
        domains: item,
        isTest: false
      }
    } else {
      if (typeof item.domains === 'string') {
        item.domains = item.domains.split(',')
      }

      const { cert_name: certName, is_test: isTest, ..._item } = item

      item = { ..._item, certName, isTest }
    }

    item.domains = item.domains.map((domain) => domain.trim())

    return item
  })
}
