"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildObserveEventsTable = buildObserveEventsTable;
exports.buildObserveEventsJson = buildObserveEventsJson;
const tslib_1 = require("tslib");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const metricNames_1 = require("./metricNames");
function formatTimestamp(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}
function resolveCustomParams(event) {
    return event.customParams ?? null;
}
function buildObserveEventsTable(events, pageInfo, options) {
    if (events.length === 0) {
        return chalk_1.default.yellow('No events found.');
    }
    const hasUpdates = events.some(e => e.appUpdateId);
    const headers = [
        'Value',
        'App Version',
        ...(hasUpdates ? ['Update'] : []),
        'Platform',
        'Device',
        'Country',
        'Timestamp',
    ];
    const rows = events.map(event => [
        `${event.metricValue.toFixed(2)}s`,
        `${event.appVersion} (${event.appBuildNumber})`,
        ...(hasUpdates ? [event.appUpdateId ?? '-'] : []),
        `${event.deviceOs} ${event.deviceOsVersion}`,
        event.deviceModel,
        event.countryCode ?? '-',
        formatTimestamp(event.timestamp),
    ]);
    const colWidths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => r[i].length)));
    const headerLine = headers.map((h, i) => h.padEnd(colWidths[i])).join('  ');
    const separatorLine = colWidths.map(w => '-'.repeat(w)).join('  ');
    const dataLines = rows.map(row => row.map((cell, i) => cell.padEnd(colWidths[i])).join('  '));
    const lines = [];
    if (options) {
        const metricDisplay = (0, metricNames_1.getMetricDisplayName)(options.metricName);
        let timeDesc;
        if (options.daysBack) {
            timeDesc = `for the last ${options.daysBack} days`;
        }
        else if (options.startTime && options.endTime) {
            timeDesc = `from ${formatDate(options.startTime)} to ${formatDate(options.endTime)}`;
        }
        else {
            timeDesc = '';
        }
        const totalDesc = options.totalEventCount != null
            ? ` — ${options.totalEventCount.toLocaleString()} total events`
            : '';
        lines.push(chalk_1.default.bold(`${metricDisplay} events ${timeDesc}${totalDesc}`.trim()), '');
    }
    lines.push(chalk_1.default.bold(headerLine), separatorLine, ...dataLines);
    if (pageInfo.hasNextPage && pageInfo.endCursor) {
        lines.push('', `Next page: --after ${pageInfo.endCursor}`);
    }
    return lines.join('\n');
}
function buildObserveEventsJson(events, pageInfo) {
    return {
        events: events.map(event => ({
            id: event.id,
            metricName: event.metricName,
            metricValue: event.metricValue,
            appVersion: event.appVersion,
            appBuildNumber: event.appBuildNumber,
            appUpdateId: event.appUpdateId ?? null,
            deviceModel: event.deviceModel,
            deviceOs: event.deviceOs,
            deviceOsVersion: event.deviceOsVersion,
            countryCode: event.countryCode ?? null,
            sessionId: event.sessionId ?? null,
            easClientId: event.easClientId,
            timestamp: event.timestamp,
            customParams: resolveCustomParams(event),
        })),
        pageInfo: {
            hasNextPage: pageInfo.hasNextPage,
            endCursor: pageInfo.endCursor ?? null,
        },
    };
}
