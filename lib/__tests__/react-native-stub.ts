export const AppState = {
  currentState: "active",
  addEventListener: (_type: string, _handler: (state: string) => void) => ({
    remove() {},
  }),
};

export const InteractionManager = {
  runAfterInteractions: (callback: () => void) => {
    callback();
    return { cancel() {} };
  },
};

export const Platform = { OS: "ios" };
