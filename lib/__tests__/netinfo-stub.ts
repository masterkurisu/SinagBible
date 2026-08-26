const NetInfo = {
  fetch: async () => ({
    isConnected: true,
    isInternetReachable: true,
    type: "wifi" as const,
  }),
  addEventListener: (_handler: (state: unknown) => void) => {
    return () => {};
  },
};

export default NetInfo;
