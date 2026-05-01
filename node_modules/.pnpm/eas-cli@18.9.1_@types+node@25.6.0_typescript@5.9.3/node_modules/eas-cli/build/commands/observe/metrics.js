"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const core_1 = require("@oclif/core");
const EasCommand_1 = tslib_1.__importDefault(require("../../commandUtils/EasCommand"));
const flags_1 = require("../../commandUtils/flags");
const generated_1 = require("../../graphql/generated");
const log_1 = tslib_1.__importDefault(require("../../log"));
const fetchMetrics_1 = require("../../observe/fetchMetrics");
const formatMetrics_1 = require("../../observe/formatMetrics");
const metricNames_1 = require("../../observe/metricNames");
const startAndEndTime_1 = require("../../observe/startAndEndTime");
const json_1 = require("../../utils/json");
const DEFAULT_METRICS = [
    'expo.app_startup.cold_launch_time',
    'expo.app_startup.warm_launch_time',
    'expo.app_startup.tti',
    'expo.app_startup.ttr',
    'expo.app_startup.bundle_load_time',
];
const DEFAULT_STATS_TABLE = ['median', 'eventCount'];
const DEFAULT_STATS_JSON = [
    'min',
    'median',
    'max',
    'average',
    'p80',
    'p90',
    'p99',
    'eventCount',
];
class ObserveMetrics extends EasCommand_1.default {
    static hidden = true;
    static description = 'display app performance metrics grouped by app version';
    static flags = {
        platform: core_1.Flags.option({
            description: 'Filter by platform',
            options: Object.values(generated_1.AppObservePlatform).map(s => s.toLowerCase()),
        })(),
        metric: core_1.Flags.option({
            description: 'Metric name to display (can be specified multiple times).',
            multiple: true,
            options: Object.keys(metricNames_1.METRIC_ALIASES),
        })(),
        stat: core_1.Flags.option({
            description: 'Statistic to display per metric (can be specified multiple times)',
            multiple: true,
            options: DEFAULT_STATS_JSON,
        })(),
        start: core_1.Flags.string({
            description: 'Start of time range for metrics data (ISO date).',
            exclusive: ['days'],
        }),
        end: core_1.Flags.string({
            description: 'End of time range for metrics data (ISO date).',
            exclusive: ['days'],
        }),
        days: core_1.Flags.integer({
            description: 'Show metrics from the last N days (mutually exclusive with --start/--end)',
            min: 1,
            exclusive: ['start', 'end'],
        }),
        'project-id': core_1.Flags.string({
            description: 'EAS project ID (defaults to the project ID of the current directory)',
        }),
        ...flags_1.EasNonInteractiveAndJsonFlags,
    };
    static contextDefinition = {
        ...this.ContextOptions.ProjectId,
        ...this.ContextOptions.LoggedIn,
    };
    static loggedInOnlyContextDefinition = {
        ...this.ContextOptions.LoggedIn,
    };
    async runAsync() {
        const { flags } = await this.parse(ObserveMetrics);
        let projectId;
        let graphqlClient;
        if (flags['project-id']) {
            projectId = flags['project-id'];
            const ctx = await this.getContextAsync({ contextDefinition: ObserveMetrics.loggedInOnlyContextDefinition }, { nonInteractive: flags['non-interactive'] });
            graphqlClient = ctx.loggedIn.graphqlClient;
        }
        else {
            const ctx = await this.getContextAsync(ObserveMetrics, {
                nonInteractive: flags['non-interactive'],
            });
            projectId = ctx.projectId;
            graphqlClient = ctx.loggedIn.graphqlClient;
        }
        if (flags.json) {
            (0, json_1.enableJsonOutput)();
        }
        else {
            log_1.default.warn('EAS Observe is in preview and subject to breaking changes.');
        }
        const metricNames = flags.metric?.length
            ? flags.metric.map(metricNames_1.resolveMetricName)
            : DEFAULT_METRICS;
        const { daysBack, startTime, endTime } = (0, startAndEndTime_1.resolveTimeRange)(flags);
        const platforms = flags.platform
            ? [flags.platform === 'android' ? generated_1.AppPlatform.Android : generated_1.AppPlatform.Ios]
            : [generated_1.AppPlatform.Android, generated_1.AppPlatform.Ios];
        const { metricsMap, buildNumbersMap, updateIdsMap, totalEventCounts } = await (0, fetchMetrics_1.fetchObserveMetricsAsync)(graphqlClient, projectId, metricNames, platforms, startTime, endTime);
        const argumentsStat = flags.stat?.length
            ? Array.from(new Set(flags.stat.map(formatMetrics_1.resolveStatKey)))
            : undefined;
        if (flags.json) {
            const stats = argumentsStat ?? DEFAULT_STATS_JSON;
            (0, json_1.printJsonOnlyOutput)((0, formatMetrics_1.buildObserveMetricsJson)(metricsMap, metricNames, stats, totalEventCounts, buildNumbersMap, updateIdsMap));
        }
        else {
            const stats = argumentsStat ?? DEFAULT_STATS_TABLE;
            log_1.default.addNewLineIfNone();
            log_1.default.log((0, formatMetrics_1.buildObserveMetricsTable)(metricsMap, metricNames, stats, {
                daysBack,
                buildNumbersMap,
                totalEventCounts,
            }));
        }
    }
}
exports.default = ObserveMetrics;
