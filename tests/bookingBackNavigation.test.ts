import { CommonActions, StackActions, StackRouter } from "@react-navigation/routers";
import { describe, expect, it } from "vitest";
import { goBackOrFallback } from "@/navigation/goBackOrFallback";

describe.each([
  ["TripList", "TripDetail"],
  ["OwnerBookingList", "OwnerBookingDetail"],
  ["ExploreMain", "VehicleDetail"],
  ["FavoriteVehicles", "VehicleDetail"],
  ["TripList", "VehicleDetail"],
  ["OwnerBookingList", "VehicleDetail"],
])("booking back navigation: %s", (list, detail) => {
  function stack(initialRouteName: string) {
    const router = StackRouter({ initialRouteName });
    const config = { routeNames: [list, detail], routeParamList: {}, routeGetIdList: {} };
    let state = router.getInitialState(config);
    let unhandled = 0;
    function dispatch(action: ReturnType<typeof CommonActions.goBack> | ReturnType<typeof StackActions.push> | ReturnType<typeof StackActions.replace>) {
      const next = router.getStateForAction(state, action, config);
      if (next) state = router.getRehydratedState(next, config);
      else unhandled++;
    }
    const navigation = {
      canGoBack: () => router.getStateForAction(state, CommonActions.goBack(), config) !== null,
      goBack: () => dispatch(CommonActions.goBack()),
    };
    return { navigation, dispatch, current: () => state, unhandled: () => unhandled };
  }

  it("replaces a directly opened detail with its list without dispatching an unhandled back action", () => {
    const nav = stack(detail);
    expect(nav.navigation.canGoBack()).toBe(false);
    goBackOrFallback(nav.navigation, () => nav.dispatch(StackActions.replace(list)));
    expect(nav.current().routes.map(r => r.name)).toEqual([list]);
    expect(nav.unhandled()).toBe(0);
  });

  it("pops normally when the detail was opened from the list", () => {
    const nav = stack(list);
    nav.dispatch(StackActions.push(detail, { bookingId: 42 }));
    expect(nav.navigation.canGoBack()).toBe(true);
    goBackOrFallback(nav.navigation, () => nav.dispatch(StackActions.replace(list)));
    expect(nav.current().routes.map(r => r.name)).toEqual([list]);
    expect(nav.unhandled()).toBe(0);
  });
});
