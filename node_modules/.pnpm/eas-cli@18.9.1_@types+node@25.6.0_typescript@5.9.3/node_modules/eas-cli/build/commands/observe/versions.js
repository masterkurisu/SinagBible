"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const core_1 = require("@oclif/core");
const EasCommand_1 = tslib_1.__importDefault(require("../../commandUtils/EasCommand"));
const flags_1 = require("../../commandUtils/flags");
const generated_1 = require("../../graphql/generated");
const log_1 = tslib_1.__importDefault(require("../../log"));
const fetchVersions_1 = require("../../observe/fetchVersions");
const formatVersions_1 = require("../../observe/formatVersions");
const startAndEndTime_1 = require("../../observe/startAndEndTime");
const json_1 = require("../../utils/json");
class ObserveVersions extends EasCommand_1.default {
    static hidden = true;
    static description = 'display app versions with build and update details';
    static flags = {
        platform: core_1.Flags.option({
            description: 'Filter by platform',
            options: Object.values(generated_1.AppObservePlatform).map(s => s.toLowerCase()),
        })(),
        start: core_1.Flags.string({
            description: 'Start of time range (ISO date)',
            exclusive: ['days'],
        }),
        end: core_1.Flags.string({
            description: 'End of time range (ISO date)',
            exclusive: ['days'],
        }),
        days: core_1.Flags.integer({
            description: 'Show versions from the last N days (mutually exclusive with --start/--end)',
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
        const { flags } = await this.parse(ObserveVersions);
        let projectId;
        let graphqlClient;
        if (flags['project-id']) {
            projectId = flags['project-id'];
            const ctx = await this.getContextAsync({ contextDefinition: ObserveVersions.loggedInOnlyContextDefinition }, { nonInteractive: flags['non-interactive'] });
            graphqlClient = ctx.loggedIn.graphqlClient;
        }
        else {
            const ctx = await this.getContextAsync(ObserveVersions, {
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
        const { startTime, endTime } = (0, startAndEndTime_1.resolveTimeRange)(flags);
        const platforms = flags.platform
            ? [flags.platform === 'android' ? generated_1.AppPlatform.Android : generated_1.AppPlatform.Ios]
            : [generated_1.AppPlatform.Android, generated_1.AppPlatform.Ios];
        const results = await (0, fetchVersions_1.fetchObserveVersionsAsync)(graphqlClient, projectId, platforms, startTime, endTime);
        if (flags.json) {
            (0, json_1.printJsonOnlyOutput)((0, formatVersions_1.buildObserveVersionsJson)(results));
        }
        else {
            log_1.default.addNewLineIfNone();
            log_1.default.log((0, formatVersions_1.buildObserveVersionsTable)(results));
        }
    }
}
exports.default = ObserveVersions;
