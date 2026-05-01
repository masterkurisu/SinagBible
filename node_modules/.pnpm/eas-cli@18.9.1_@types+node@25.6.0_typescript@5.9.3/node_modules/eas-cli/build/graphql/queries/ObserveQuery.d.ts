import { ExpoGraphqlClient } from '../../commandUtils/context/contextUtils/createGraphqlClient';
import { AppObserveAppVersion, AppObserveEvent, AppObserveEventsFilter, AppObserveEventsOrderBy, AppObservePlatform, AppObserveTimeSeriesStatistics, PageInfo } from '../generated';
export type AppObserveTimeSeriesResult = {
    appVersionMarkers: AppObserveAppVersion[];
    eventCount: number;
    statistics: AppObserveTimeSeriesStatistics;
};
type AppObserveEventsQueryVariables = {
    appId: string;
    filter?: AppObserveEventsFilter;
    first?: number;
    after?: string;
    orderBy?: AppObserveEventsOrderBy;
};
export declare const ObserveQuery: {
    timeSeriesAsync(graphqlClient: ExpoGraphqlClient, { appId, metricName, platform, startTime, endTime, }: {
        appId: string;
        metricName: string;
        platform: AppObservePlatform;
        startTime: string;
        endTime: string;
    }): Promise<AppObserveTimeSeriesResult>;
    appVersionsAsync(graphqlClient: ExpoGraphqlClient, { appId, platform, startTime, endTime, metricNames, }: {
        appId: string;
        platform: AppObservePlatform;
        startTime: string;
        endTime: string;
        metricNames?: string[];
    }): Promise<AppObserveAppVersion[]>;
    eventsAsync(graphqlClient: ExpoGraphqlClient, variables: AppObserveEventsQueryVariables): Promise<{
        events: AppObserveEvent[];
        pageInfo: PageInfo;
    }>;
};
export {};
