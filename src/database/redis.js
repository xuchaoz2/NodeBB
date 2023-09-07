"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nconf_1 = __importDefault(require("nconf"));
const semver_1 = __importDefault(require("semver"));
const express_session_1 = __importDefault(require("express-session"));
const connectRedis = __importStar(require("connect-redis"));
const meta_1 = __importDefault(require("../meta"));
const connection_1 = __importDefault(require("./redis/connection"));
const redisModule = {};
redisModule.questions = [
    {
        name: 'redis:host',
        description: 'Host IP or address of your Redis instance',
        default: nconf_1.default.get('redis:host') || '127.0.0.1',
    },
    {
        name: 'redis:port',
        description: 'Host port of your Redis instance',
        default: nconf_1.default.get('redis:port') || 6379,
    },
    {
        name: 'redis:password',
        description: 'Password of your Redis database',
        hidden: true,
        default: nconf_1.default.get('redis:password') || '',
        before: function (value) { value = value || nconf_1.default.get('redis:password') || ''; return value; },
    },
    {
        name: 'redis:database',
        description: 'Which database to use (0..n)',
        default: nconf_1.default.get('redis:database') || 0,
    },
];
redisModule.init = function () {
    return __awaiter(this, void 0, void 0, function* () {
        redisModule.client = yield connection_1.default.connect(nconf_1.default.get('redis'));
    });
};
redisModule.createSessionStore = function (options) {
    return __awaiter(this, void 0, void 0, function* () {
        const sessionStore = connectRedis(express_session_1.default);
        const client = yield connection_1.default.connect(options);
        const store = new sessionStore({
            client: client,
            ttl: meta_1.default.getSessionTTLSeconds(),
        });
        return store;
    });
};
redisModule.checkCompatibility = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const info = yield redisModule.info(redisModule.client);
        yield redisModule.checkCompatibilityVersion(info.redis_version);
    });
};
redisModule.checkCompatibilityVersion = function (version, callback) {
    if (semver_1.default.lt(version, '2.8.9')) {
        callback(new Error('Your Redis version is not new enough to support NodeBB, please upgrade Redis to v2.8.9 or higher.'));
    }
    callback();
};
redisModule.close = function () {
    return __awaiter(this, void 0, void 0, function* () {
        yield redisModule.client.quit();
    });
};
redisModule.info = function (cxn) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!cxn) {
            cxn = yield connection_1.default.connect(nconf_1.default.get('redis'));
        }
        redisModule.client = redisModule.client || cxn;
        const data = yield cxn.info();
        const lines = data.toString().split('\r\n').sort();
        const redisData = {};
        lines.forEach((line) => {
            const parts = line.split(':');
            if (parts[1]) {
                redisData[parts[0]] = parts[1];
            }
        });
        const keyInfo = redisData[`db${nconf_1.default.get('redis:database')}`];
        if (keyInfo) {
            const split = keyInfo.split(',');
            redisData.keys = (split[0] || '').replace('keys=', '');
            redisData.expires = (split[1] || '').replace('expires=', '');
            redisData.avg_ttl = (split[2] || '').replace('avg_ttl=', '');
        }
        redisData.instantaneous_input = (redisData.instantaneous_input_kbps / 1024).toFixed(3);
        redisData.instantaneous_output = (redisData.instantaneous_output_kbps / 1024).toFixed(3);
        redisData.total_net_input = (redisData.total_net_input_bytes / (1024 * 1024 * 1024)).toFixed(3);
        redisData.total_net_output = (redisData.total_net_output_bytes / (1024 * 1024 * 1024)).toFixed(3);
        redisData.used_memory_human = (redisData.used_memory / (1024 * 1024 * 1024)).toFixed(3);
        redisData.raw = JSON.stringify(redisData, null, 4);
        redisData.redis = true;
        return redisData;
    });
};
redisModule.socketAdapter = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const redisAdapter = require('@socket.io/redis-adapter');
        const pub = yield connection_1.default.connect(nconf_1.default.get('redis'));
        const sub = yield connection_1.default.connect(nconf_1.default.get('redis'));
        return redisAdapter(pub, sub, {
            key: `db:${nconf_1.default.get('redis:database')}:adapter_key`,
        });
    });
};
require('./redis/main')(redisModule);
require('./redis/hash')(redisModule);
require('./redis/sets')(redisModule);
require('./redis/sorted')(redisModule);
require('./redis/list')(redisModule);
require('./redis/transaction')(redisModule);
require('../promisify')(redisModule, ['client', 'sessionStore']);
