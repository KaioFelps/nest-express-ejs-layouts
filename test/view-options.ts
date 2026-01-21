import express, { type Application } from "express"
import request from "supertest"
import { middleware as expressLayouts } from "../lib/index.js"
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let app: Application;

beforeEach(function () {
  app = express()
  app.use(expressLayouts)
  app.set('view engine', 'ejs')
  app.set('views', __dirname + '/fixtures')
  app.set('layout', 'custom-delimiter-layout.ejs')
  app.set('view options', { delimiter: '?' })
})

describe('view options', function () {
  describe('such as custom delimiters', function () {
    it('should be supported', function (done) {
      app.use(function (req, res) {
        res.render(__dirname + '/fixtures/custom-delimiter-view.ejs', { foo: 'bar' })
      })

      request(app).get('/').expect('TEMPLATE_START VIEW_START bar VIEW_END\n TEMPLATE_END\n', done)
    })
  })
})
