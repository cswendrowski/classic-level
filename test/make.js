'use strict'

const test = require('tape')
const testCommon = require('./common')

function makeTest (name, testFn) {
  test(name, async function (t) {
    const db = testCommon.factory()

    await db.open()
    await db.batch([
      { type: 'put', key: 'one', value: '1' },
      { type: 'put', key: 'two', value: '2' },
      { type: 'put', key: 'three', value: '3' }
    ])

    return testFn(db, t)
  })
}

module.exports = makeTest
