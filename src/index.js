'use strict'

import stream from 'stream'

/**
 * Compares two objects.
 * @callback mergeSortStream~Compare
 * @param {object} a The first object.
 * @param {object} b The second object.
 * @returns {number} The result.
 */

 /**
 * Creates a readable stream that merges multiple ordered streams.
 * @param {mergeSortStream~Compare} cmp The comparer.
 * @param {Array.<stream.Readable>} streams The ordered streams.
 * @returns {stream.Readable} The merged stream.
 */
function mergeSortStream(cmp, streams) {
	if (Array.isArray(cmp)) {
		streams = cmp
		cmp = function(a, b) {
			return a - b
		}
	}

	let sources = streams
		.filter(function(stream) {
			return stream.readable
		})
		.map(function(stream) {
			return {
				stream,
				buffer: []
			}
		})

	let buffered = 0

	let rs = new stream.Readable({
		objectMode: true
	})
	rs._read = function() {
		if (!buffered) {
			if (!sources.length)
				rs.push(null)
			return
		}

		if (buffered < sources.length)
			return

		let source = sources
			.filter(function(source) {
				return source.buffer.length
			})
			.reduce(function(a, b) {
				return cmp(a.buffer[0], b.buffer[0]) <= 0 ? a : b
			})

		let chunk = source.buffer.shift()

		if (!source.buffer.length) {
			--buffered

			if (!source.stream.readable) {
				for (let i = 0; i < sources.length; ++i) {
					if (sources[i] === source) {
						sources.splice(i, 1)
						break
					}
				}
			}
		}

		rs.push(chunk)
	}

	for (let source of sources) {
		let ws = new stream.Writable({
			objectMode: true
		})
		ws._write = function(chunk, encoding, callback) {
			if (!source.buffer.length)
				++buffered
			source.buffer.push(chunk)
			rs._read()
			callback()
		}

		source.stream.pipe(ws)
		source.stream.on('end', function() {
			rs._read()
		})
	}

	return rs
}

export default mergeSortStream
