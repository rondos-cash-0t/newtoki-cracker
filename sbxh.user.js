// ==UserScript==
// @name         newtoki-cracker modified
//
// @namespace    https://github.com/rondos-cash-0t/newtoki-cracker
// @homepageURL  https://github.com/rondos-cash-0t/newtoki-cracker
// @supportURL   https://github.com/rondos-cash-0t/newtoki-cracker/issues
// @updateURL    https://raw.githubusercontent.com/rondos-cash-0t/newtoki-cracker/refs/heads/main/sbxh.user.js
// @downloadURL  https://raw.githubusercontent.com/rondos-cash-0t/newtoki-cracker/refs/heads/main/sbxh.user.js
// @license      MPL-2.0
//
// @version      1.0.0
// @author       You
//
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// @connect      self
//
// @description  newtoki-cracker
//
// @match      *://sbxh1.com/*
// @match      *://sbxh2.com/*
// @match      *://sbxh3.com/*
// @match      *://sbxh4.com/*
// @match      *://sbxh5.com/*
// @match      *://sbxh6.com/*
// @match      *://sbxh7.com/*
// @match      *://sbxh8.com/*
// @match      *://sbxh9.com/*
// @match      *://sbxh10.com/*
// ==/UserScript==

/*!
 * @license MPL-2.0
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Contributors:
 *   - See Git history at https://github.com/FilteringDev/newtoki-cracker for detailed authorship information.
 */

(() => {
    "use strict";

    const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    const tag = "newtoki-cracker";

    const originalMapSet = win.Map.prototype.set;
    const originalFunctionToString = Function.prototype.toString;
    const originalSendBeacon = navigator.sendBeacon.bind(navigator);
    const originalFetch = win.fetch.bind(win);
    const originalAttachShadow = Element.prototype.attachShadow;
    const originalQuerySelectorAll = Document.prototype.querySelectorAll;
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    const originalSetAttribute = Element.prototype.setAttribute;
    const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");

    let fakeAdController = null;
    let routeObserver = null;
    let routeTimer = null;
    let lastAckPath = "";
    let lastProcessedPath = location.pathname;
    let allowCookieWrite = false;

    function log(loading, ...args) {
        console.debug(`[${tag}]`, ...args);

        if (loading) {
            const el = document.getElementsByClassName("novel-loading")[0];

            if (!el) {
                return;
            }

            const message =
                  `[${tag}] ` +
                  args.map(arg =>
                           typeof arg === "object"
                           ? JSON.stringify(arg)
                           : String(arg)
                          ).join(" ");

            el.innerHTML = message;
        }
    }

    function makeTp(challengeToken) {
        /*
        Array.from(
            new Uint8Array(
                s().buffer,
                1055660,
                32
            )
        )
        */
        const seedTable = [
            0x9E, 0x3F, 0x71, 0x2C, 0x8B, 0x4A, 0xD6, 0x15,
            0xE7, 0x5D, 0x33, 0x9A, 0x2F, 0x6C, 0x84, 0xB1,
            0x47, 0x59, 0xAE, 0x18, 0xCD, 0x7F, 0x23, 0x60,
            0x95, 0x0A, 0xDE, 0x4B, 0x72, 0x36, 0xF8, 0x11
        ];

        const input = new TextEncoder().encode(challengeToken);
        const raw = new Uint8Array(8);

        for (let j = 0; j < 8; j++) {
            let state = seedTable[((j * 7 + 3) & 31)] | 0;

            for (let i = 0; i < input.length; i++) {
                state =
                    Math.imul(state, 31) +
                    input[i] +
                    seedTable[((i + j) & 31)];

                state |= 0;
            }

            raw[j] = state & 0xff;
        }

        return [...raw]
            .map(v => v.toString(16).padStart(2, "0"))
            .join("");
    }

    function dispatchAckReady() {
        win.__ntk_ad_ack_scope = location.pathname;

        win.dispatchEvent(
            new win.CustomEvent("ntk-ad-ack-ready", {
                detail: {
                    scope: win.__ntk_ad_ack_scope
                }
            })
        );
    }

    function removeDispatchAck() {
        deleteLocalStorage("ntk:ad-trust-until");
        delete win.__ntk_ad_ack_scope;
    }

    function createRandomHex(length = 16) {
        return [...crypto.getRandomValues(new Uint8Array(length))]
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    function cancelFakeAdShow() {
        if (fakeAdController) {
            fakeAdController.abort();
            delete win.__ntk_ad_ack_scope;
            fakeAdController = null;
            log(true, 'fakeAdShow aborted!');
        }

        clearTimeout(routeTimer);
        routeTimer = null;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function cloneFetchArgs(args) {
        const [input, init = {}] = args;

        if (input instanceof Request) {
            return [input.clone()];
        }

        return [
            input,
            {
                ...init,
                credentials: init.credentials || "include"
            }
        ];
    }

    async function retryFetch(
    fetchFn,
     thisArg,
     fetchArgs,
     {
        maxRetries = 10,
        delayMs = 1500,
        signal = null
    } = {}
    ) {
        const requestUrl = getRequestUrl(fetchArgs[0]);
        let lastResponse = null;
        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            if (signal?.aborted) {
                throw new DOMException('Operation aborted', 'AbortError');
            }

            try {
                const response = await Reflect.apply(
                    fetchFn,
                    thisArg,
                    cloneFetchArgs(fetchArgs)
                );

                lastResponse = response;

                if (
                    response.status !== 502 &&
                    response.status !== 503 &&
                    response.status !== 504
                ) {
                    return response;
                }

                log(true, `${requestUrl} | ${response.status} detected (${attempt}/${maxRetries}), retrying...`);
            } catch (err) {
                lastError = err;

                if (signal?.aborted || err?.name === 'AbortError') {
                    throw err;
                }

                log(true, `${requestUrl} | fetch error (${attempt}/${maxRetries}): ${err?.message || err}`);
            }

            if (attempt < maxRetries) {
                await Promise.race([
                    sleep(delayMs),
                    new Promise((_, reject) => {
                        signal?.addEventListener(
                            'abort',
                            () => reject(
                                new DOMException(
                                    'Operation aborted',
                                    'AbortError'
                                )
                            ),
                            { once: true }
                        );
                    })
                ]);
            }
        }

        if (lastResponse) {
            return lastResponse;
        }

        throw lastError ?? new Error('Fetch failed after retries.');
    }

    function getPathParts() {
        return location.pathname.split("/").filter(Boolean);
    }

    function isTargetPage() {
        const parts = getPathParts();

        return (
            parts.length === 3 && ["manhwa", "novel", "webtoon"].includes(parts[0])
        );
    }

    function getRequestUrl(input) {
        if (typeof input === "string") {
            return input;
        }

        if (input instanceof URL) {
            return input.pathname;
        }

        if (input instanceof Request) {
            return input.url;
        }

        return input?.url || "";
    }

    function rawSetCookie(value) {
        cookieDesc.set.call(document, value);
    }

    function setCookieData(name, value) {
        const maxAge = 60 * 60 * 4; // 4 hours

        rawSetCookie(
            `${encodeURIComponent(name)}=${encodeURIComponent(value)}; ` +
            `Path=/; ` +
            `Max-Age=${maxAge}; ` +
            `SameSite=Lax; ` +
            `Secure`);
    }

    function hasCookie(name) {
        return document.cookie
            .split(';')
            .some(cookie => cookie.trim().startsWith(`${name}=`));
    }

    function getCookie(name) {
        return document.cookie
            .split('; ')
            .find(row => row.startsWith(name + '='))
            ?.split('=')
            .slice(1)
            .join('=') ?? null;
    }

    function deleteLocalStorage(name) {
        if (localStorage.getItem(name) !== null) {
            localStorage.removeItem(name);
        }
    }

    async function ensureNvCookie(force) {
        if (hasCookie("nv") && force !== true) {
            return true;
        }

        await retryFetch(originalFetch, win, [
            new URL(`https://${location.hostname}/api/nv-issue`),
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                keepalive: true
            }
        ]);

        return hasCookie("nv");
    }

    function installMapHook() {
        win.Map.prototype.set = new Proxy(originalMapSet, {
            apply(target, thisArg, args) {
                const [key, value] = args;

                if (typeof key === "number" && typeof value === "function") {
                    const fnSource = Reflect.apply(
                        originalFunctionToString,
                        value,
                        []
                    );

                    const blockedPatterns = [
                        [/getBoundingClientRect\(\)/],
                        [/\) *return *void */]
                    ];

                    const matched = blockedPatterns.some(patternGroup =>
                        patternGroup.every(pattern => pattern.test(fnSource))
                    );

                    if (matched) {
                        log(false, "blocked Map.prototype.set payload");
                        return;
                    }
                }

                return Reflect.apply(target, thisArg, args);
            }
        });
    }

    function installBeaconHook() {
        navigator.sendBeacon = new Proxy(originalSendBeacon, {
            apply(target, thisArg, args) {
                const [url, data] = args;
                const urlString = String(url);
                const blockedEndpoints = new Set([
                    "/api/m/ev",
                    "https://whoas.xyz/collect",
                    "https://whoas.xyz/beacon"
                ]);

                if (
                    [...blockedEndpoints].some(endpoint =>
                        urlString.includes(endpoint)
                    )
                ) {
                    log(false, "blocked sendBeacon:", urlString, data);
                    return true;
                }

                return Reflect.apply(target, thisArg, args);
            }
        });
    }

    function installFetchHook() {
        const blockedEndpoints = new Set([
            "/api/ad/challenge",
            "/api/ad/canary",
            "/api/ad/ack",
            "/api/m/ev",
            "/api/m/i",
            "/api/nv-issue",
            "/api/me",
            "/wasm/ad-guard/ad_guard.js",
            "/wasm/ad-guard/ad_guard_bg.wasm"
        ]);

        const retryRefreshEndpoints = new Set([
            "/api/manhwa-images",
            "/api/webtoon-images",
            "/api/novel-content"
        ]);

        const shouldMatch = (url, endpoints) =>
        [...endpoints].some(endpoint => url.includes(endpoint));

        win.fetch = new Proxy(win.fetch, {
            async apply(target, thisArg, args) {
                const requestUrl = getRequestUrl(args[0]);
                const options = args[1];

                const body =
                      options &&
                      typeof options === "object" &&
                      "body" in options
                ? options.body
                : null;

                if (shouldMatch(requestUrl, blockedEndpoints)) {
                    return Promise.resolve(
                        new Response(null, { status: 204 })
                    );
                }

                if (shouldMatch(requestUrl, retryRefreshEndpoints)) {
                    return retryFetch(
                        target,
                        thisArg,
                        args,{}
                    );
                }

                return Reflect.apply(target, thisArg, args);
            }
        });
    }

    function installShadowHook() {
        Element.prototype.attachShadow = new Proxy(originalAttachShadow, {
            apply(target, thisArg, args) {
                const options = args[0];

                const isBlockingOverlay =
                    thisArg instanceof HTMLElement &&
                    options?.mode === "closed" &&
                    thisArg.outerHTML.length > 100 &&
                    document.body?.style.overflow === "hidden" &&
                    document.documentElement?.style.overflow === "hidden";

                if (isBlockingOverlay) {
                    document.body.style.overflow = "";
                    document.documentElement.style.overflow = "";

                    log(false, "blocked closed shadow overlay");

                    throw new Error("blocked closed shadow overlay");
                }

                return Reflect.apply(target, thisArg, args);
            }
        });
    }

    function installQuerySelectorHook() {
        Document.prototype.querySelectorAll = new Proxy(originalQuerySelectorAll, {
            apply(target, thisArg, args) {
                const selector = args[0];

                if (
                    typeof selector === "string" &&
                    selector.includes('[data-br="')
                ) {
                    return [];
                }

                return Reflect.apply(target, thisArg, args);
            }
        });
    }

    function installHistoryHook() {
        history.pushState = function(...args) {
            const result = originalPushState.apply(this, args);
            onLocationChange();
            return result;
        };

        history.replaceState = function(...args) {
            const result = originalReplaceState.apply(this, args);
            onLocationChange();
            return result;
        };

        win.addEventListener("popstate", () => {
            onLocationChange();
        });
    }

    function installAdHideStyle() {
        if (document.getElementById("ntk-hide-ad-style")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "ntk-hide-ad-style";
        style.textContent = `
[data-br="1"] {
    position: fixed !important;
    left: 0 !important;
    top: 0 !important;
    width: 1px !important;
    height: 1px !important;
    overflow: hidden !important;
    opacity: 0.01 !important;
    pointer-events: none !important;
    z-index: -1 !important;
}
`;

        document.documentElement.appendChild(style);

        const removeAdImages = () => {
            document.querySelectorAll("[data-br] img").forEach(img => {
                img.removeAttribute("src");
                img.removeAttribute("srcset");
                img.removeAttribute("sizes");

                img.dataset.ntkBlocked = "1";
            });
        };

        removeAdImages();

        new MutationObserver(() => {
            removeAdImages();
        }).observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        Element.prototype.setAttribute = new Proxy(originalSetAttribute, {
            apply(target, thisArg, args) {
                const [name, value] = args;

                if (
                    thisArg instanceof HTMLImageElement &&
                    thisArg.closest("[data-br]") &&
                    ["src", "srcset"].includes(name)
                ) {
                    return;
                }

                return Reflect.apply(target, thisArg, args);
            }
        });

    }

    async function fakeAdShow() {
        if (!isTargetPage()) {
            return;
        }

        const controller = new AbortController();
        fakeAdController = controller;
        const startPath = location.pathname;
        const isCanceled = () => controller.signal.aborted ||
                               startPath !== location.pathname;

        try {
            const advertCount = Reflect.apply(
                originalQuerySelectorAll,
                document,
                ["[data-br] img"]
            ).length;

            if (isCanceled()) return;

            log(true, "fakeAd Start!");
            removeDispatchAck();

            const ok = await ensureNvCookie();

            if (ok) {
                log(false, "nv cookie okay!");
            } else {
                log(true, "nv cookie error! aborted!");
                throw new Error("nv cookie error! aborted.");
                return;
            }

            if (isCanceled()) return;

            const pid = getCookie('ntk_pid') ??
                  createRandomHex();

            log(false, "ntk_pid:", pid);
            setCookieData('ntk_pid', pid);

            log(false, "CurrentAdvertContainerCount:", advertCount);

            const challengeResponse = await retryFetch(originalFetch, win, [
                new URL(`https://${location.hostname}/api/ad/challenge`),
                {
                    body: JSON.stringify({
                        path: location.pathname
                    }),
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "include",
                    keepalive: true,
                    cache: "no-store"
                }
            ], {signal: controller.signal});

            if (!challengeResponse.ok) {
                log(true, "challenge failed:", challengeResponse.status);
                return;
            }

            if (isCanceled()) return;

            const json = await challengeResponse.json();
            const challenge = json?.challenge;

            if (json?.ok === true && json?.trusted === true) {
                if (isCanceled()) return;

                removeDispatchAck();
                dispatchAckReady();
                log(true, "trust ok! sended ack ready custom event! waiting...");
                fakeAdController = null;
                return;
            }

            if (isCanceled()) return;

            if (!challenge?.token || !challenge?.impressionUrls || !challenge.minSeen) {
                log(true, "invalid challenge response:", json);
                return;
            }

            if (isCanceled()) return;

            const challengeToken = challenge.token;
            const impression = challenge?.impressionUrls;
            const minSeen = challenge?.minSeen;

            log(false, "challengeToken:", challengeToken);
            log(false, "impressionUrls:", impression);
            log(false, "minSeen:", minSeen);

            const impressionLen = Math.min(impression.length, minSeen);
            /*const selectedData = [...impression]
                .sort(() => Math.random() - 0.5)
                .slice(0, impressionLen);*/
            const selectedData = [...impression]
                .slice(0, impressionLen);
            /* const tp_rnd = createRandomHex(); */
            const tp_rnd = makeTp(challengeToken);

            if (isCanceled()) return;

            log(true, "tp:", tp_rnd);

            // Removed 2026-06-08
            /*const observationResponse = await retryFetch(originalFetch, win, [
                new URL(`https://${location.hostname}${observationBatchUrl}`),
                {
                    body: JSON.stringify({
                        challengeToken,
                        urls: selectedData,
                        path: location.pathname
                    }),
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "include",
                    keepalive: true
                }
            ], {signal: controller.signal});*/

            // Added 2026-06-08
            let tempCount = 0;
            for (const path of selectedData) {
                if (isCanceled()) return;
                tempCount++;
                log(true, `connecting temp page... | ${tempCount}/${selectedData.length}`);
                const tempResponse = await retryFetch(originalFetch, win, [
                    new URL(`https://${location.hostname}${path}`),
                    {
                        method: "GET",
                        credentials: "include",
                        keepalive: true
                    }
                ], {signal: controller.signal});
                if (tempResponse.status >= 500) {
                    log(true, "temp response error! aborted!");
                    return;
                }
            }

            if (isCanceled()) return;

            log(true, "connecting ack...");
            const ackResponse = await retryFetch(originalFetch, win, [
                new URL(`https://${location.hostname}/api/ad/ack`),
                {
                    body: JSON.stringify({
                        challengeToken,
                        tp: tp_rnd,
                        td: 0,
                        total: advertCount,
                        visible: advertCount,
                        path: location.pathname
                    }),
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "include",
                    keepalive: true
                }
            ], {signal: controller.signal});

            if (ackResponse.status >= 500 || !ackResponse.ok) {
                log(true, "ack response error! aborted!");
                return;
            }

            if (isCanceled()) return;

            removeDispatchAck();
            dispatchAckReady();

            log(true, "sended ack ready custom event! waiting...");
            fakeAdController = null;
        } catch (error) {
            fakeAdController = null;
            if (error?.name === "AbortError") {
                log(true, "fakeAdShow aborted:", error);
                return;
            }
            log(true, "fakeAdShow error:", error);
        }
    }

    function scheduleFakeAdShow() {
        clearTimeout(routeTimer);
        const randTimeout = Math.floor(Math.random() * 50 + 50);

        routeTimer = setTimeout(() => {
            if (!isTargetPage()) {
                return;
            }

            if (lastAckPath === location.pathname) {
                return;
            }

            lastAckPath = location.pathname;
            fakeAdShow();
        }, randTimeout);
    }

    function waitForAdContainer() {
        routeObserver?.disconnect();
        routeObserver = null;

        if (!isTargetPage()) {
            return;
        }

        if (document.querySelector("[data-br]")) {
            scheduleFakeAdShow();
            return;
        }

        routeObserver = new MutationObserver(() => {
            if (!document.querySelector("[data-br]")) {
                return;
            }

            routeObserver.disconnect();
            routeObserver = null;

            scheduleFakeAdShow();
        });

        routeObserver.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    function onLocationChange() {
        if (lastProcessedPath !== location.pathname) {
            log(false, "route changed:", location.pathname);
            lastProcessedPath = location.pathname;
            cancelFakeAdShow();
            waitForAdContainer();
        }
    }

    function installConsoleLogHook() {
        const script = document.createElement('script');

        script.textContent = `
        (() => {
            const originalLog = console.log.bind(console);

            Object.defineProperty(console, 'log', {
                value: function (...args) {
                    if (
                        args.length === 1 &&
                        args[0] &&
                        typeof args[0] === 'object' &&
                        args[0].constructor === Object &&
                        Object.keys(args[0]).length === 0
                    ) {
                        return;
                    }

                    if (
                        Array.isArray(args) &&
                        args.length >= 30 &&
                        args.every(x => x && typeof x === 'object')
                       ) {
                        return;
                    }

                    return originalLog(...args);
                },
                writable: false,
                configurable: false
            });

            Object.defineProperty(console, 'clear', {
                value: function () {
                    return;
                },
                writable: false,
                configurable: false
            });
        })();
    `;

        document.documentElement.appendChild(script);
        script.remove();
    };

    function installVisibilityGuard() {
        const observer = new MutationObserver(() => {
            if (
                document.body &&
                document.body.style.visibility === 'hidden'
            ) {
                log(false, 'blocked body.style.visibility = hidden');

                document.body.style.visibility = 'visible';
            }
        });

        const start = () => {
            if (!document.body) {
                requestAnimationFrame(start);
                return;
            }

            observer.observe(document.body, {
                attributes: true,
                attributeFilter: ['style']
            });
        };

        start();
    }

    function main() {
        installConsoleLogHook();
        installVisibilityGuard();

        installAdHideStyle();
        installMapHook();
        installFetchHook();
        installBeaconHook();
        installShadowHook();
        installQuerySelectorHook();
        installHistoryHook();

        waitForAdContainer();
    }

    main();
})();
