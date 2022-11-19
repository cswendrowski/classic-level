'use strict'

const { AbstractIterator } = require('abstract-level')
const binding = require('./binding')

const kContext = Symbol('context')
const kCache = Symbol('cache')
const kFirst = Symbol('first')
const kPosition = Symbol('position')
const kSignal = Symbol('signal')
const kAbort = Symbol('abort')
const empty = []

// Does not implement _all() because the default implementation
// of abstract-level falls back to nextv(1000) and using all()
// on more entries than that probably isn't a realistic use case,
// so it'll typically just make one nextv(1000) call and there's
// no performance gain in overriding _all().
class Iterator extends AbstractIterator {
  constructor (db, context, options) {
    super(db, options)

    this[kContext] = binding.iterator_init(context, options)
    this[kFirst] = true
    this[kCache] = empty
    this[kPosition] = 0
    this[kAbort] = this[kAbort].bind(this)

    // TODO: consider exposing iterator.signal in abstract-level
    if (options.signal != null) {
      this[kSignal] = options.signal
      this[kSignal].addEventListener('abort', this[kAbort], { once: true })
    } else {
      this[kSignal] = null
    }
  }

  _seek (target, options) {
    this[kFirst] = true
    this[kCache] = empty
    this[kPosition] = 0

    binding.iterator_seek(this[kContext], target)
  }

  // TODO (v2): document/benchmark that we now always need a last call
  async _next () {
    if (this[kPosition] < this[kCache].length) {
      return this[kCache][this[kPosition]++]
    }

    if (this[kFirst]) {
      // It's common to only want one entry initially or after a seek()
      this[kFirst] = false
      this[kCache] = await binding.iterator_nextv(this[kContext], 1)
      this[kPosition] = 0
    } else {
      // Limit the size of the cache to prevent starving the event loop
      // while we're recursively nexting.
      this[kCache] = await binding.iterator_nextv(this[kContext], 1000)
      this[kPosition] = 0
    }

    if (this[kPosition] < this[kCache].length) {
      return this[kCache][this[kPosition]++]
    }
  }

  // TODO (v2): read from cache first?
  async _nextv (size, options) {
    this[kFirst] = false
    return binding.iterator_nextv(this[kContext], size)
  }

  async _close () {
    this[kCache] = empty

    if (this[kSignal] !== null) {
      this[kSignal].removeEventListener('abort', this[kAbort])
      this[kSignal] = null
    }

    return binding.iterator_close(this[kContext])
  }

  [kAbort] () {
    this[kSignal] = null
    binding.iterator_abort(this[kContext])
  }

  // Undocumented, exposed for tests only
  get cached () {
    return this[kCache].length - this[kPosition]
  }
}

exports.Iterator = Iterator
