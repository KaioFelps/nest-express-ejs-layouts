/**
 * NestJs Express EJS Layouts
 * Adapted from 'express-ejs-layouts'
 *
 * Copyright (c) 2015 Jonathan Soares
 * Licensed under the MIT License
 * * Source: https://github.com/soarez/express-ejs-layouts
 */

import type { NextFunction, Request as HttpRequest, Response as ExpressResponse } from "express";

function contentFor(contentName: string) {
  return CONTENT_PATTERN + contentName + CONTENT_PATTERN;
}

interface HttpResponse extends ExpressResponse {
  [ORIGINAL_RENDER_FN]?: RenderFn
}

type Locals = {
  body?: string | undefined;
  script?: string | undefined;
  style?: string | undefined;
  meta?: string | undefined;
  [key: PropertyKey]: unknown;
};

const CONTENT_PATTERN = "&&<>&&";
export const ORIGINAL_RENDER_FN = "__render";

export type RenderFn = (
  view: string,
  options?: Record<string, unknown> | RenderCallback,
  callback?: RenderCallback,
) => PromiseLike<string | void>;

export type RenderCallback = (err: Error | null, html?: string) => void;
/**
 * Renders the view with the configured layout.
 * This is a helper function that can be used standalone (i.e., inside interceptors, if needed).
 *
 * @param render The original function (bound to the request)
 * @param req The express HTTP request
 * @param res The express HTTP response
 * @param view The view to render
 * @param options The view data
 * @param callback The callback to run with either the error or the resulting HTML
 * @returns the resulting HTML if `callback` has not been set
 */
export async function renderWithLayout(
  render: RenderFn,
  req: HttpRequest,
  res: HttpResponse,
  view: string,
  options: Record<string, unknown> = {},
  callback?: RenderCallback,
): Promise<string | void> {
  const app = req.app;
  const defaultLayout = app.get("layout");

  if (typeof options === "function") {
    callback = options as RenderCallback;
    options = {};
  }

  async function renderAsync(view: string, options: Record<string, unknown>) {
    return new Promise<string>((resolve, reject) => {
      render(view, options, (err, html) => {
        if (err) return reject(err);

        if (html && typeof (html as any).then === "function") {
          (html as unknown as Promise<string>).then(resolve, reject);
        } else {
          resolve(html as string);
        }
      });
    });
  }

  const getRenderedHtml = async () => {
    const layoutsHasBeenDisabled = options.layout === false || (options.layout || defaultLayout) === false;
    if (layoutsHasBeenDisabled) return await renderAsync(view, options);

    const _layout: string | undefined | boolean = options.layout || res.locals.layout || defaultLayout;
    const layout = (_layout === true || !_layout) ? "layout" : _layout;
    
    options.contentFor = contentFor;

    const str = await renderAsync(view, options);

    const locals = {
      body: str,
      defineContent: (contentName: string) => locals[contentName] || "",
    } as Locals;

    for (const optionKey in options) {
      if (options.hasOwnProperty(optionKey) && optionKey !== 'layout' && optionKey !== 'contentFor') {
        locals[optionKey] = options[optionKey];
      }
    }

    const couldntSuccessfullyRender = typeof locals.body !== "string";

    if (couldntSuccessfullyRender) {
      console.warn(`Could not successfully render view ${view} with layout ${layout}. Rendering without the layout instead.`);
      return str;
    }

    if (options.extractScripts === true || (options.extractScripts === undefined && app.get('layout extractScripts') === true)) {
      locals.script = "";
      parseScripts(locals);
    }

    if (options.extractStyles === true || (options.extractStyles === undefined && app.get('layout extractStyles') === true)) {
      locals.style = "";
      parseStyles(locals);
    }

    if (options.extractMetas === true || (options.extractMetas === undefined && app.get('layout extractMetas') === true)) {
      locals.meta = "";
      parseMetas(locals);
    }

    parseContents(locals);
    return await renderAsync(layout, locals);
  };

  try {
    const html = await getRenderedHtml();
    if (callback) return callback(null, html);
    res.status(200).type("text/html").send(html);
  } catch (error) {
    if (callback) return callback(error as Error);
    throw error;
  }
}

export const middleware = async (
  request: HttpRequest,
  response: HttpResponse,
  next: NextFunction,
) => {
  if (!(ORIGINAL_RENDER_FN in response)) {
    response[ORIGINAL_RENDER_FN] = response.render as RenderFn;
  }

  // @ts-ignore
  response.render = async (
    view: string,
    options: Record<string, unknown>,
    callback: RenderCallback,
  ) => {
    try {
      await renderWithLayout(
        response[ORIGINAL_RENDER_FN]!.bind(response),
        request,
        response,
        view,
        options as Record<string, unknown>,
        callback,
      );
    } catch (error) {
      next(error); 
    }
  };

  next();
};

function parseContents(locals: Locals) {
  const str = locals.body as string;

  const regex = new RegExp(
    `\r?\n?${CONTENT_PATTERN}.+?${CONTENT_PATTERN}\r?\n?`,
    "g",
  );

  const split = str.split(regex);
  const partials = str.match(regex);

  locals.body = split[0];

  if (!partials) return;

  for (let i = 0; i < partials.length; i++) {
    const partial = partials[i];
    const name = partial?.split(CONTENT_PATTERN)[1];
    if(name) locals[name] = split[i + 1];
  }
}

function parseScripts(locals: Locals) {
  const str = locals.body;
  const regex = /<script[\s\S]*?>[\s\S]*?<\/script>/g;
  const script = str?.match(regex);

  if (!script) return;

  locals.body = str?.replace(regex, "");
  locals.script = script.join("\n");
}

function parseStyles(locals: Locals) {
  const str = locals.body;
  const regex =
    /(?:<style[\s\S]*?>[\s\S]*?<\/style>)|(?:<link[\s\S]*?>(?:<\/link>)?)/g;
  const style = str?.match(regex);

  if (!style) return;

  locals.body = str?.replace(regex, "");
  locals.style = style.join("\n");
}

function parseMetas(locals: Locals) {
  const str = locals.body;
  const regex = /<meta[\s\S]*?>/g;
  const meta = str?.match(regex);

  if (!meta) return;

  locals.body = str?.replace(regex, "");
  locals.meta = meta.join("\n");
}
