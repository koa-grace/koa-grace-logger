'use strict';

/**
 * Module dependencies.
 */

const Counter = require('passthrough-counter');
const bytes = require('bytes');

/**
 * Expose logger.
 */

module.exports = dev;

/**
 * Development logger.
 */

function dev(opts) {
  let env = opts.env || 'development';

  return function* logger(next) {
    // request
    let start = new Date;

    try {
      yield next;
    } catch (err) {
      // log uncaught downstream errors
      log(this, start, null, err);
      throw err;
    }

    // 开发环境不使用这个日志
    if (env == 'development') {
      return;
    }

    // calculate the length of a streaming response
    // by intercepting the stream with a counter.
    // only necessary if a content-length header is currently not set.
    let length = this.response.length;
    let body = this.body;
    let counter;
    if (null == length && body && body.readable) {
      this.body = body
        .pipe(counter = Counter())
        .on('error', this.onerror);
    }

    // log when the response is finished or closed,
    // whichever happens first.
    let ctx = this;
    let res = this.res;

    res.once('finish', done);
    res.once('close', done);

    function done() {
      res.removeListener('finish', done);
      res.removeListener('close', done);
      log(ctx, start, counter ? counter.length : length, null);
    }
  }
}

/**
 * Log helper.
 */

function log(ctx, start, len, err) {
  // get the status code of the response
  let status = err ? (err.status || 500) : (ctx.status || 404);

  // get the human readable response length
  let length;
  if (~[204, 205, 304].indexOf(status)) {
    length = '';
  } else if (null == len) {
    length = '-';
  } else {
    length = bytes(len);
  }

  let logs = [
    function ip() {
      let curIp = ctx.headers['x-forwarded-for'] || ctx.ip;
      return curIp.replace('::ffff:', '');
    },
    function method() {
      return ctx.method;
    },
    function url() {
      return ctx.originalUrl;
    },
    function status() {
      return ctx.status;
    },
    function httpVer() {
      return ctx.req.httpVersion;
    },
    function protocol() {
      return ctx.protocol.toUpperCase();
    },
    function size() {
      return length
    },
    function referer() {
      return ctx.header['referer'] || '-'
    },
    function userAgent() {
      return ctx.header['user-agent'] || '-';
    },
    function time() {
      return Date.now();
    }
  ]

  let log = '';
  logs.forEach(function(item) {
    log += item() + ' | '
  });
  log += time(start);

  console.log(log)
}

/**
 * Show the response time in a human readable format.
 * In milliseconds if less than 10 seconds,
 * in seconds otherwise.
 */

function time(start) {
  let delta = new Date - start;
  delta = delta < 10000 ? delta + 'ms' : Math.round(delta / 1000) + 's';
  return delta;
}