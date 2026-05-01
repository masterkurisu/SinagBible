import { ExpoGraphqlClient } from '../../commandUtils/context/contextUtils/createGraphqlClient';
import { CreateDeviceRunSessionInput, CreateDeviceRunSessionMutation, StopDeviceRunSessionMutation } from '../generated';
export declare const DeviceRunSessionMutation: {
    createDeviceRunSessionAsync(graphqlClient: ExpoGraphqlClient, deviceRunSessionInput: CreateDeviceRunSessionInput): Promise<CreateDeviceRunSessionMutation["deviceRunSession"]["createDeviceRunSession"]>;
    stopDeviceRunSessionAsync(graphqlClient: ExpoGraphqlClient, deviceRunSessionId: string): Promise<StopDeviceRunSessionMutation["deviceRunSession"]["stopDeviceRunSession"]>;
};
