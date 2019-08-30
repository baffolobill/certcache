/* global test expect */

const getDomainsFromConfig = require('./getDomainsFromConfig')

const expectedDomains1 = ['example.com', 'test.example.com']
const expectedDomains2 = ['test2.example.com', 'test3.example.com', 'test4.example.com']
const certName1 = 'test-cert-name'
const certName2 = 'test-cert-name2'
const isTest1 = false
const isTest2 = true
const config1 = {
  domains: expectedDomains1,
  cert_name: certName1,
  is_test: isTest1
}
const config2 = {
  domains: expectedDomains2,
  cert_name: certName2,
  is_test: isTest2
}

test(
  'should handle a 1-dimensional array of comma-separated domains',
  () => {
    expect(getDomainsFromConfig([
      expectedDomains1.join(','),
      expectedDomains2.join(',')
    ]))
      .toEqual([
        {
          domains: expectedDomains1,
          isTest: false,
          certName: expectedDomains1[0]
        },
        {
          domains: expectedDomains2,
          isTest: false,
          certName: expectedDomains2[0]
        }
      ])
  }
)

test(
  'should handle a 2-dimensional array of domains',
  () => {
    expect(getDomainsFromConfig([
      expectedDomains1,
      expectedDomains2
    ]))
      .toEqual([
        {
          domains: expectedDomains1,
          isTest: false,
          certName: expectedDomains1[0]
        },
        {
          domains: expectedDomains2,
          isTest: false,
          certName: expectedDomains2[0]
        }
      ])
  }
)

test(
  'should handle an array of objects containins an array of domains',
  () => {
    expect(getDomainsFromConfig([config1, config2]))
      .toEqual([
        { certName: certName1, isTest: isTest1, domains: expectedDomains1 },
        { certName: certName2, isTest: isTest2, domains: expectedDomains2 }
      ])
  }
)

test(
  'should handle an array of objects containing comma-separated domains',
  () => {
    expect(getDomainsFromConfig([
      { ...config1, domains: expectedDomains1.join(',') },
      { ...config2, domains: expectedDomains2.join(',') }
    ]))
      .toEqual([
        { certName: certName1, isTest: isTest1, domains: expectedDomains1 },
        { certName: certName2, isTest: isTest2, domains: expectedDomains2 }
      ])
  }
)

test(
  'should ignore leading/trailing spaces in domains',
  () => {
    expect(getDomainsFromConfig([
      { ...config1, domains: expectedDomains1.join(', ') },
      { ...config2, domains: [...expectedDomains2, ' foo.com '] }
    ]))
      .toEqual([
        { certName: certName1, isTest: isTest1, domains: expectedDomains1 },
        {
          certName: certName2,
          isTest: isTest2,
          domains: [...expectedDomains2, 'foo.com']
        }
      ])
  }
)
