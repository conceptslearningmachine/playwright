/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { it, expect, options } from './playwright.fixtures';
import fs from 'fs';
import utils from './utils';
const { removeUserDataDir, makeUserDataDir } = utils;

it('should support hasTouch option', async ({server, launchPersistent}) => {
  const {page} = await launchPersistent({hasTouch: true});
  await page.goto(server.PREFIX + '/mobile.html');
  expect(await page.evaluate(() => 'ontouchstart' in window)).toBe(true);
});

it('should work in persistent context', (test, parameters) => {
  test.skip(options.FIREFOX(parameters));
}, async ({server, launchPersistent}) => {
  // Firefox does not support mobile.
  const {page} = await launchPersistent({viewport: {width: 320, height: 480}, isMobile: true});
  await page.goto(server.PREFIX + '/empty.html');
  expect(await page.evaluate(() => window.innerWidth)).toBe(980);
});

it('should support colorScheme option', async ({launchPersistent}) => {
  const {page} = await launchPersistent({colorScheme: 'dark'});
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(false);
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
});

it('should support timezoneId option', async ({launchPersistent}) => {
  const {page} = await launchPersistent({locale: 'en-US', timezoneId: 'America/Jamaica'});
  expect(await page.evaluate(() => new Date(1479579154987).toString())).toBe('Sat Nov 19 2016 13:12:34 GMT-0500 (Eastern Standard Time)');
});

it('should support locale option', async ({launchPersistent}) => {
  const {page} = await launchPersistent({locale: 'fr-CH'});
  expect(await page.evaluate(() => navigator.language)).toBe('fr-CH');
});

it('should support geolocation and permissions options', async ({server, launchPersistent}) => {
  const {page} = await launchPersistent({geolocation: {longitude: 10, latitude: 10}, permissions: ['geolocation']});
  await page.goto(server.EMPTY_PAGE);
  const geolocation = await page.evaluate(() => new Promise(resolve => navigator.geolocation.getCurrentPosition(position => {
    resolve({latitude: position.coords.latitude, longitude: position.coords.longitude});
  })));
  expect(geolocation).toEqual({latitude: 10, longitude: 10});
});

it('should support ignoreHTTPSErrors option', async ({httpsServer, launchPersistent}) => {
  const {page} = await launchPersistent({ignoreHTTPSErrors: true});
  let error = null;
  const response = await page.goto(httpsServer.EMPTY_PAGE).catch(e => error = e);
  expect(error).toBe(null);
  expect(response.ok()).toBe(true);
});

it('should support extraHTTPHeaders option', (test, parameters) => {
  test.flaky(options.FIREFOX(parameters) && !options.HEADLESS && options.LINUX(parameters), 'Intermittent timeout on bots');
}, async ({server, launchPersistent}) => {
  const {page} = await launchPersistent({extraHTTPHeaders: { foo: 'bar' }});
  const [request] = await Promise.all([
    server.waitForRequest('/empty.html'),
    page.goto(server.EMPTY_PAGE),
  ]);
  expect(request.headers['foo']).toBe('bar');
});

it('should accept userDataDir', (test, parameters) => {
  test.flaky(options.CHROMIUM(parameters));
}, async ({launchPersistent, tmpDir}) => {
  const {context} = await launchPersistent();
  // Note: we need an open page to make sure its functional.
  expect(fs.readdirSync(tmpDir).length).toBeGreaterThan(0);
  await context.close();
  expect(fs.readdirSync(tmpDir).length).toBeGreaterThan(0);
  // This might throw. See https://github.com/GoogleChrome/puppeteer/issues/2778
  await removeUserDataDir(tmpDir);
});

it('should restore state from userDataDir', (test, parameters) => {
  test.slow();
}, async ({browserType, defaultBrowserOptions, server, launchPersistent}) => {
  const userDataDir = await makeUserDataDir();
  const browserContext = await browserType.launchPersistentContext(userDataDir, defaultBrowserOptions);
  const page = await browserContext.newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => localStorage.hey = 'hello');
  await browserContext.close();

  const browserContext2 = await browserType.launchPersistentContext(userDataDir, defaultBrowserOptions);
  const page2 = await browserContext2.newPage();
  await page2.goto(server.EMPTY_PAGE);
  expect(await page2.evaluate(() => localStorage.hey)).toBe('hello');
  await browserContext2.close();

  const userDataDir2 = await makeUserDataDir();
  const browserContext3 = await browserType.launchPersistentContext(userDataDir2, defaultBrowserOptions);
  const page3 = await browserContext3.newPage();
  await page3.goto(server.EMPTY_PAGE);
  expect(await page3.evaluate(() => localStorage.hey)).not.toBe('hello');
  await browserContext3.close();

  // This might throw. See https://github.com/GoogleChrome/puppeteer/issues/2778
  await removeUserDataDir(userDataDir);
  await removeUserDataDir(userDataDir2);
});

it('should restore cookies from userDataDir', (test, parameters) => {
  test.slow();
  test.flaky(options.CHROMIUM(parameters));
}, async ({browserType, defaultBrowserOptions,  server, launchPersistent}) => {
  const userDataDir = await makeUserDataDir();
  const browserContext = await browserType.launchPersistentContext(userDataDir, defaultBrowserOptions);
  const page = await browserContext.newPage();
  await page.goto(server.EMPTY_PAGE);
  const documentCookie = await page.evaluate(() => {
    document.cookie = 'doSomethingOnlyOnce=true; expires=Fri, 31 Dec 9999 23:59:59 GMT';
    return document.cookie;
  });
  expect(documentCookie).toBe('doSomethingOnlyOnce=true');
  await browserContext.close();

  const browserContext2 = await browserType.launchPersistentContext(userDataDir, defaultBrowserOptions);
  const page2 = await browserContext2.newPage();
  await page2.goto(server.EMPTY_PAGE);
  expect(await page2.evaluate(() => document.cookie)).toBe('doSomethingOnlyOnce=true');
  await browserContext2.close();

  const userDataDir2 = await makeUserDataDir();
  const browserContext3 = await browserType.launchPersistentContext(userDataDir2, defaultBrowserOptions);
  const page3 = await browserContext3.newPage();
  await page3.goto(server.EMPTY_PAGE);
  expect(await page3.evaluate(() => document.cookie)).not.toBe('doSomethingOnlyOnce=true');
  await browserContext3.close();

  // This might throw. See https://github.com/GoogleChrome/puppeteer/issues/2778
  await removeUserDataDir(userDataDir);
  await removeUserDataDir(userDataDir2);
});

it('should have default URL when launching browser', async ({launchPersistent}) => {
  const {context} = await launchPersistent();
  const urls = context.pages().map(page => page.url());
  expect(urls).toEqual(['about:blank']);
});

it('should throw if page argument is passed', (test, parameters) => {
  test.skip(options.FIREFOX(parameters));
}, async ({browserType, defaultBrowserOptions, server, tmpDir}) => {
  const options = {...defaultBrowserOptions, args: [server.EMPTY_PAGE] };
  const error = await browserType.launchPersistentContext(tmpDir, options).catch(e => e);
  expect(error.message).toContain('can not specify page');
});

it('should have passed URL when launching with ignoreDefaultArgs: true', (test, parameters) => {
  test.skip(options.WIRE);
}, async ({browserType, defaultBrowserOptions, server, tmpDir, toImpl}) => {
  const args = toImpl(browserType)._defaultArgs(defaultBrowserOptions, 'persistent', tmpDir, 0).filter(a => a !== 'about:blank');
  const options = {
    ...defaultBrowserOptions,
    args: [...args, server.EMPTY_PAGE],
    ignoreDefaultArgs: true,
  };
  const browserContext = await browserType.launchPersistentContext(tmpDir, options);
  if (!browserContext.pages().length)
    await browserContext.waitForEvent('page');
  await browserContext.pages()[0].waitForLoadState();
  const gotUrls = browserContext.pages().map(page => page.url());
  expect(gotUrls).toEqual([server.EMPTY_PAGE]);
  await browserContext.close();
});

it('should handle timeout', (test, parameters) => {
  test.skip(options.WIRE);
}, async ({browserType, defaultBrowserOptions, tmpDir}) => {
  const options = { ...defaultBrowserOptions, timeout: 5000, __testHookBeforeCreateBrowser: () => new Promise(f => setTimeout(f, 6000)) };
  const error = await browserType.launchPersistentContext(tmpDir, options).catch(e => e);
  expect(error.message).toContain(`browserType.launchPersistentContext: Timeout 5000ms exceeded.`);
});

it('should handle exception', (test, parameters) => {
  test.skip(options.WIRE);
}, async ({browserType, defaultBrowserOptions, tmpDir}) => {
  const e = new Error('Dummy');
  const options = { ...defaultBrowserOptions, __testHookBeforeCreateBrowser: () => { throw e; } };
  const error = await browserType.launchPersistentContext(tmpDir, options).catch(e => e);
  expect(error.message).toContain('Dummy');
});

it('should fire close event for a persistent context', async ({launchPersistent}) => {
  const {context} = await launchPersistent();
  let closed = false;
  context.on('close', () => closed = true);
  await context.close();
  expect(closed).toBe(true);
});

it('coverage should work', (test, parameters) => {
  test.skip(!options.CHROMIUM(parameters));
}, async ({server, launchPersistent}) => {
  const {page} = await launchPersistent();
  await page.coverage.startJSCoverage();
  await page.goto(server.PREFIX + '/jscoverage/simple.html', { waitUntil: 'load' });
  const coverage = await page.coverage.stopJSCoverage();
  expect(coverage.length).toBe(1);
  expect(coverage[0].url).toContain('/jscoverage/simple.html');
  expect(coverage[0].functions.find(f => f.functionName === 'foo').ranges[0].count).toEqual(1);
});

it('coverage should be missing', (test, parameters) => {
  test.skip(options.CHROMIUM(parameters));
}, async ({launchPersistent}) => {
  const {page} = await launchPersistent();
  expect(page.coverage).toBe(null);
});

it('should respect selectors', async ({playwright, launchPersistent}) => {
  const {page} = await launchPersistent();

  const defaultContextCSS = () => ({
    create(root, target) {},
    query(root, selector) {
      return root.querySelector(selector);
    },
    queryAll(root: HTMLElement, selector: string) {
      return Array.from(root.querySelectorAll(selector));
    }
  });
  await utils.registerEngine(playwright, 'defaultContextCSS', defaultContextCSS);

  await page.setContent(`<div>hello</div>`);
  expect(await page.innerHTML('css=div')).toBe('hello');
  expect(await page.innerHTML('defaultContextCSS=div')).toBe('hello');
});
