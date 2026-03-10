"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealityAuth = void 0;
exports.getRealityAuth = getRealityAuth;
const axios_1 = __importDefault(require("axios"));
const BASE_URL = 'https://api.reality.cz';
const LOGIN_ENDPOINT = '/moje-reality/prihlasit2/';
const USER_AGENT = 'Android Mobile Client 3.1.4b47';
const AUTH_TOKEN = 'Token 5c858f9578fc6f0a12ec9f367b1807b3';
const SESSION_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // ~1 year (refresh well before 2-year expiry)
class RealityAuth {
    constructor() {
        this.sessionId = null;
        this.sessionCreatedAt = 0;
        this.client = axios_1.default.create({
            baseURL: BASE_URL,
            timeout: 30000,
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'application/json',
                'Authorization': AUTH_TOKEN,
            },
            // Don't follow redirects automatically for login
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 400,
        });
    }
    async getSession() {
        if (this.sessionId && !this.isSessionExpired()) {
            return this.sessionId;
        }
        await this.login();
        return this.sessionId;
    }
    isSessionExpired() {
        return Date.now() - this.sessionCreatedAt > SESSION_MAX_AGE_MS;
    }
    async login() {
        // Guest login - empty body is sufficient to get a session cookie
        const response = await this.client.post(LOGIN_ENDPOINT, 'mrregemail=&mrregh=&fcm_id=&os=6', {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        const sid = this.extractSessionId(response);
        if (!sid) {
            throw new Error('Failed to extract session ID from login response');
        }
        this.sessionId = sid;
        this.sessionCreatedAt = Date.now();
        console.log('[RealityAuth] Session acquired');
    }
    extractSessionId(response) {
        const setCookieHeaders = response.headers['set-cookie'];
        if (!setCookieHeaders)
            return null;
        for (const cookie of setCookieHeaders) {
            const match = cookie.match(/sid=([^;]+)/);
            if (match) {
                return match[1];
            }
        }
        return null;
    }
    async request(url) {
        const sid = await this.getSession();
        const response = await this.client.get(url, {
            headers: {
                'Cookie': `sid=${sid}`,
            },
        });
        // Check if server issued a new session cookie
        const newSid = this.extractSessionId(response);
        if (newSid && newSid !== this.sessionId) {
            this.sessionId = newSid;
            this.sessionCreatedAt = Date.now();
        }
        return response.data;
    }
    async post(url, data) {
        const sid = await this.getSession();
        const response = await this.client.post(url, data, {
            headers: {
                'Cookie': `sid=${sid}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        const newSid = this.extractSessionId(response);
        if (newSid && newSid !== this.sessionId) {
            this.sessionId = newSid;
            this.sessionCreatedAt = Date.now();
        }
        return response.data;
    }
    getSessionId() {
        return this.sessionId;
    }
    clearSession() {
        this.sessionId = null;
        this.sessionCreatedAt = 0;
    }
}
exports.RealityAuth = RealityAuth;
// Singleton instance for the scraper
let authInstance = null;
function getRealityAuth() {
    if (!authInstance) {
        authInstance = new RealityAuth();
    }
    return authInstance;
}
