"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var puppeteer_1 = require("puppeteer");
var fs = require("fs");
function inspectRealityCz() {
    return __awaiter(this, void 0, void 0, function () {
        var browser, page, url, html, analysis, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Launching browser...');
                    return [4 /*yield*/, puppeteer_1.default.launch({
                            headless: true,
                            args: ['--no-sandbox', '--disable-setuid-sandbox']
                        })];
                case 1:
                    browser = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 10, 11, 13]);
                    return [4 /*yield*/, browser.newPage()];
                case 3:
                    page = _a.sent();
                    // Set user agent to avoid detection
                    return [4 /*yield*/, page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')];
                case 4:
                    // Set user agent to avoid detection
                    _a.sent();
                    console.log('Navigating to reality.cz...');
                    url = 'https://www.reality.cz/prodej/byty/Ceska-republika/';
                    return [4 /*yield*/, page.goto(url, {
                            waitUntil: 'networkidle2',
                            timeout: 30000
                        })];
                case 5:
                    _a.sent();
                    // Wait a bit for any dynamic content
                    return [4 /*yield*/, page.waitForTimeout(3000)];
                case 6:
                    // Wait a bit for any dynamic content
                    _a.sent();
                    console.log('Getting page HTML...');
                    return [4 /*yield*/, page.content()];
                case 7:
                    html = _a.sent();
                    // Save full HTML
                    fs.writeFileSync('reality-full-page.html', html);
                    console.log('✓ Saved full HTML to reality-full-page.html');
                    // Try to find common property listing patterns
                    console.log('\n--- Analyzing HTML structure ---\n');
                    return [4 /*yield*/, page.evaluate(function () {
                            var results = {
                                possibleContainers: [],
                                linkPatterns: [],
                                dataAttributes: [],
                                classPatterns: []
                            };
                            // Find elements with "property", "item", "card", "listing", "offer" in class names
                            var allElements = document.querySelectorAll('*');
                            var classKeywords = ['property', 'item', 'card', 'listing', 'offer', 'advert', 'estate'];
                            allElements.forEach(function (el) {
                                var classes = el.className;
                                if (typeof classes === 'string' && classes) {
                                    classKeywords.forEach(function (keyword) {
                                        if (classes.toLowerCase().includes(keyword)) {
                                            if (!results.classPatterns.includes(classes)) {
                                                results.classPatterns.push(classes);
                                            }
                                        }
                                    });
                                }
                                // Check for data attributes
                                Array.from(el.attributes).forEach(function (attr) {
                                    if (attr.name.startsWith('data-')) {
                                        if (!results.dataAttributes.includes(attr.name)) {
                                            results.dataAttributes.push(attr.name);
                                        }
                                    }
                                });
                            });
                            // Find all links that might be property links
                            var links = document.querySelectorAll('a[href]');
                            links.forEach(function (link) {
                                var href = link.href;
                                if (href.includes('reality.cz') && (href.includes('/prodej/') || href.includes('/L00-') || href.includes('/428-'))) {
                                    var pattern = href.replace(/[0-9]+/g, 'X');
                                    if (!results.linkPatterns.includes(pattern)) {
                                        results.linkPatterns.push(pattern);
                                    }
                                }
                            });
                            // Look for repeated structures (likely listing containers)
                            var repeatedSelectors = {};
                            allElements.forEach(function (el) {
                                if (el.className && typeof el.className === 'string') {
                                    var selector = el.tagName.toLowerCase() + '.' + el.className.split(' ')[0];
                                    repeatedSelectors[selector] = (repeatedSelectors[selector] || 0) + 1;
                                }
                            });
                            // Find selectors that appear multiple times (likely listing items)
                            Object.entries(repeatedSelectors).forEach(function (_a) {
                                var selector = _a[0], count = _a[1];
                                if (count >= 5 && count <= 100) { // Reasonable range for listings per page
                                    results.possibleContainers.push({ selector: selector, count: count });
                                }
                            });
                            return results;
                        })];
                case 8:
                    analysis = _a.sent();
                    console.log('Possible container selectors (appearing 5-100 times):');
                    analysis.possibleContainers.forEach(function (item) {
                        console.log("  ".concat(item.selector, ": ").concat(item.count, " instances"));
                    });
                    console.log('\nRelevant class patterns found:');
                    analysis.classPatterns.slice(0, 20).forEach(function (cls) {
                        console.log("  ".concat(cls));
                    });
                    console.log('\nData attributes found:');
                    analysis.dataAttributes.slice(0, 15).forEach(function (attr) {
                        console.log("  ".concat(attr));
                    });
                    console.log('\nLink patterns found:');
                    analysis.linkPatterns.slice(0, 10).forEach(function (pattern) {
                        console.log("  ".concat(pattern));
                    });
                    // Save analysis
                    fs.writeFileSync('reality-analysis.json', JSON.stringify(analysis, null, 2));
                    console.log('\n✓ Saved analysis to reality-analysis.json');
                    // Take a screenshot
                    return [4 /*yield*/, page.screenshot({ path: 'reality-page-screenshot.png', fullPage: true })];
                case 9:
                    // Take a screenshot
                    _a.sent();
                    console.log('✓ Saved screenshot to reality-page-screenshot.png');
                    return [3 /*break*/, 13];
                case 10:
                    error_1 = _a.sent();
                    console.error('Error:', error_1);
                    throw error_1;
                case 11: return [4 /*yield*/, browser.close()];
                case 12:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 13: return [2 /*return*/];
            }
        });
    });
}
inspectRealityCz().catch(console.error);
