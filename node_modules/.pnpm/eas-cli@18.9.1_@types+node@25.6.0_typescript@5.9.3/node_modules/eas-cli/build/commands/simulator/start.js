"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const core_1 = require("@oclif/core");
const url_1 = require("../../build/utils/url");
const EasCommand_1 = tslib_1.__importDefault(require("../../commandUtils/EasCommand"));
const flags_1 = require("../../commandUtils/flags");
const generated_1 = require("../../graphql/generated");
const DeviceRunSessionMutation_1 = require("../../graphql/mutations/DeviceRunSessionMutation");
const DeviceRunSessionQuery_1 = require("../../graphql/queries/DeviceRunSessionQuery");
const log_1 = tslib_1.__importStar(require("../../log"));
const ora_1 = require("../../ora");
const promise_1 = require("../../utils/promise");
const nullthrows_1 = tslib_1.__importDefault(require("nullthrows"));
const POLL_INTERVAL_MS = 5_000; // 5 seconds
const POLL_TIMEOUT_MS = 15 * 60 * 1_000; // 15 minutes
// Mapping enum → CLI flag value. Declared as Record<DeviceRunSessionType, string>
// so adding a new enum value in codegen fails the build until it is wired up here.
const DEVICE_RUN_SESSION_TYPE_FLAG_VALUES = {
    [generated_1.DeviceRunSessionType.AgentDevice]: 'agent-device',
};
const DEVICE_RUN_SESSION_TYPE_BY_FLAG_VALUE = Object.fromEntries(Object.entries(DEVICE_RUN_SESSION_TYPE_FLAG_VALUES).map(([type, value]) => [value, type]));
class SimulatorStart extends EasCommand_1.default {
    static hidden = true;
    static description = '[EXPERIMENTAL] start a remote simulator session on EAS and get the credentials to connect to it with the CLI tool of your choice';
    static flags = {
        platform: core_1.Flags.option({
            description: 'Device platform',
            options: ['android', 'ios'],
            required: true,
        })(),
        type: core_1.Flags.option({
            description: 'Type of device run session to create',
            options: Object.values(DEVICE_RUN_SESSION_TYPE_FLAG_VALUES),
            default: DEVICE_RUN_SESSION_TYPE_FLAG_VALUES[generated_1.DeviceRunSessionType.AgentDevice],
        })(),
        'package-version': core_1.Flags.string({
            description: 'Version of the package backing the device run session (e.g. "0.1.3-alpha.3"). Defaults to "latest" when omitted.',
        }),
        ...flags_1.EASNonInteractiveFlag,
    };
    static contextDefinition = {
        ...this.ContextOptions.ProjectId,
        ...this.ContextOptions.LoggedIn,
    };
    async runAsync() {
        const { flags } = await this.parse(SimulatorStart);
        const { projectId, loggedIn: { graphqlClient }, } = await this.getContextAsync(SimulatorStart, {
            nonInteractive: flags['non-interactive'],
        });
        const platform = flags.platform === 'android' ? generated_1.AppPlatform.Android : generated_1.AppPlatform.Ios;
        const createSpinner = (0, ora_1.ora)('🚀 Creating device run session').start();
        let deviceRunSessionId;
        try {
            const session = await DeviceRunSessionMutation_1.DeviceRunSessionMutation.createDeviceRunSessionAsync(graphqlClient, {
                appId: projectId,
                platform,
                type: DEVICE_RUN_SESSION_TYPE_BY_FLAG_VALUE[flags.type],
                packageVersion: flags['package-version'],
            });
            deviceRunSessionId = session.id;
            const jobRunId = (0, nullthrows_1.default)(session.turtleJobRun?.id, 'Expected device run session to start');
            const jobRunUrl = (0, url_1.getBareJobRunUrl)(session.app.ownerAccount.name, session.app.slug, jobRunId);
            createSpinner.succeed(`Device run session created (id: ${deviceRunSessionId}) ${(0, log_1.link)(jobRunUrl)}`);
        }
        catch (err) {
            createSpinner.fail('Failed to create device run session');
            throw err;
        }
        const checkReadiness = getReadinessCheckerForType(flags.type);
        const pollSpinner = (0, ora_1.ora)(`⏳ Waiting for ${flags.type} daemon to start`).start();
        const deadline = Date.now() + POLL_TIMEOUT_MS;
        let result = { ready: false };
        try {
            while (Date.now() < deadline) {
                const session = await DeviceRunSessionQuery_1.DeviceRunSessionQuery.byIdAsync(graphqlClient, deviceRunSessionId);
                if (session.status === generated_1.DeviceRunSessionStatus.Errored ||
                    session.status === generated_1.DeviceRunSessionStatus.Stopped) {
                    throw new Error(`Device run session ${deviceRunSessionId} ${session.status.toLowerCase()} before the ${flags.type} daemon was ready.`);
                }
                const jobRunStatus = session.turtleJobRun?.status;
                if (jobRunStatus === generated_1.JobRunStatus.Errored ||
                    jobRunStatus === generated_1.JobRunStatus.Canceled ||
                    jobRunStatus === generated_1.JobRunStatus.Finished) {
                    throw new Error(`Turtle job run for device run session ${deviceRunSessionId} ${jobRunStatus.toLowerCase()} before the ${flags.type} daemon was ready.`);
                }
                const logMessages = await fetchLogMessagesAsync(session.turtleJobRun?.logFileUrls ?? []);
                result = checkReadiness(logMessages);
                if (result.ready) {
                    pollSpinner.succeed(`🎉 ${flags.type} daemon is ready`);
                    break;
                }
                await (0, promise_1.sleepAsync)(POLL_INTERVAL_MS);
            }
        }
        catch (err) {
            pollSpinner.fail(`Failed while polling for ${flags.type} daemon logs`);
            throw err;
        }
        if (!result.ready) {
            pollSpinner.fail(`Timed out waiting for ${flags.type} daemon to start`);
            throw new Error(`Timed out after ${Math.round(POLL_TIMEOUT_MS / 1000)}s waiting for ${flags.type} daemon to start.`);
        }
        log_1.default.newLine();
        log_1.default.log(`🔑 Run the following in your shell to attach to ${flags.type}:`);
        log_1.default.newLine();
        log_1.default.log(result.message);
        log_1.default.newLine();
        log_1.default.log(`When you are done, stop the session with: eas simulator:stop --id ${deviceRunSessionId}`);
    }
}
exports.default = SimulatorStart;
function getReadinessCheckerForType(type) {
    switch (type) {
        case DEVICE_RUN_SESSION_TYPE_FLAG_VALUES[generated_1.DeviceRunSessionType.AgentDevice]:
            return checkAgentDeviceReadiness;
        default:
            throw new Error(`Unsupported device run session type: ${type}`);
    }
}
const AGENT_DEVICE_BASE_URL_ENV_VAR = 'AGENT_DEVICE_DAEMON_BASE_URL';
const AGENT_DEVICE_AUTH_TOKEN_ENV_VAR = 'AGENT_DEVICE_DAEMON_AUTH_TOKEN';
function checkAgentDeviceReadiness(logMessages) {
    let baseUrl;
    let authToken;
    for (const msg of logMessages) {
        baseUrl = baseUrl ?? extractExportedEnvValue(msg, AGENT_DEVICE_BASE_URL_ENV_VAR);
        authToken = authToken ?? extractExportedEnvValue(msg, AGENT_DEVICE_AUTH_TOKEN_ENV_VAR);
        if (baseUrl && authToken) {
            break;
        }
    }
    if (baseUrl && authToken) {
        return {
            ready: true,
            message: [
                `export ${AGENT_DEVICE_BASE_URL_ENV_VAR}='${baseUrl}'`,
                `export ${AGENT_DEVICE_AUTH_TOKEN_ENV_VAR}='${authToken}'`,
            ].join('\n'),
        };
    }
    return { ready: false };
}
async function fetchLogMessagesAsync(logUrls) {
    const messages = [];
    for (const url of logUrls) {
        const text = await fetchLogTextAsync(url);
        if (!text) {
            continue;
        }
        for (const line of text.split('\n')) {
            if (!line.trim()) {
                continue;
            }
            messages.push(extractLogMessage(line));
        }
    }
    return messages;
}
async function fetchLogTextAsync(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return undefined;
        }
        return await response.text();
    }
    catch {
        return undefined;
    }
}
function extractLogMessage(line) {
    // Turtle job run logs are JSONL (bunyan-shaped), e.g.
    //   {"msg":"export FOO=\"bar\"","time":"...","logId":"..."}
    // Fall back to the raw line if it's not JSON or doesn't have a string msg.
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) {
        return line;
    }
    try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && 'msg' in parsed) {
            const msg = parsed.msg;
            if (typeof msg === 'string') {
                return msg;
            }
        }
    }
    catch {
        // not JSON, fall through
    }
    return line;
}
function extractExportedEnvValue(text, varName) {
    // Matches: export NAME=value | export NAME="value" | export NAME='value'
    const pattern = new RegExp(`export\\s+${escapeRegExp(varName)}=(?:"([^"]*)"|'([^']*)'|(\\S+))`);
    const match = pattern.exec(text);
    if (!match) {
        return undefined;
    }
    return match[1] ?? match[2] ?? match[3];
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
