import express, { type Application } from "express"
import request from "supertest"
import { middleware as expressLayouts, type RenderFn } from "../lib/index.js"
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let app: Application;

beforeEach(function () {
  app = express()
  app.use(expressLayouts)
  app.set('env', 'test');
  app.set('view engine', 'ejs')
  app.set('views', __dirname + '/fixtures')
})

describe('not using layout', function () {
  it('should not use layouts if layout is set to false in the view options', function (done) {
    app.set('layout', true)
    app.use(function (req, res) {
      res.render(__dirname + '/fixtures/view.ejs', { layout: false })
    })

    request(app).get('/').expect('hi', done)
  })

  it('should not use layouts if app.set("layout", false) and nothing was said in the view options', function (done) {
    app.set('layout', false)
    app.use(function (req, res) {
      res.render(__dirname + '/fixtures/view.ejs')
    })

    request(app).get('/').expect('hi', done)
  })

  it('should not use layouts if body is not a string', function (done) {
    const jsonEngine = function (path, options, callback) {
      require('fs').readFile(path, function (err: Error, content: string) {
        if (err) return callback?.(err)
        return callback?.(null, JSON.parse(content.toString()))
      })
    } as RenderFn;

    app.engine('json', jsonEngine as any)

    app.set('layout', true)
    app.use(function (req, res) {
      res.render(__dirname + '/fixtures/view.json', { body: { foo: 'bar' } })
    })

    request(app).get('/').expect({}, done)
  })
})
