import { useState } from "react";
import { View } from "react-native";
import MyVehicleDetailScreen from "@/features/vehicles/screens/MyVehicleDetailScreen";
import MyVehicleWizardScreen from "@/features/vehicles/screens/MyVehicleWizardScreen";
import MyVehiclesListScreen from "@/features/vehicles/screens/MyVehiclesListScreen";

type Route =
  | { name: "list" }
  | { name: "detail"; vehicleId: number }
  | { name: "add" }
  | { name: "edit"; vehicleId: number };

export default function OwnerVehiclesScreen() {
  const [route, setRoute] = useState<Route>({ name: "list" });
  const [refreshToken, setRefreshToken] = useState(0);

  function refreshList() {
    setRefreshToken((t) => t + 1);
  }

  if (route.name === "detail") {
    return (
      <View style={{ flex: 1 }}>
        <MyVehicleDetailScreen
          vehicleId={route.vehicleId}
          onBack={() => {
            setRoute({ name: "list" });
            refreshList();
          }}
          onEdit={(id) => setRoute({ name: "edit", vehicleId: id })}
          onDeleted={() => {
            setRoute({ name: "list" });
            refreshList();
          }}
        />
      </View>
    );
  }

  if (route.name === "add") {
    return (
      <View style={{ flex: 1 }}>
        <MyVehicleWizardScreen
          mode="add"
          onBack={() => setRoute({ name: "list" })}
          onDone={() => {
            setRoute({ name: "list" });
            refreshList();
          }}
        />
      </View>
    );
  }

  if (route.name === "edit") {
    return (
      <View style={{ flex: 1 }}>
        <MyVehicleWizardScreen
          mode="edit"
          vehicleId={route.vehicleId}
          onBack={() => setRoute({ name: "detail", vehicleId: route.vehicleId })}
          onDone={() => {
            setRoute({ name: "detail", vehicleId: route.vehicleId });
            refreshList();
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <MyVehiclesListScreen
        refreshToken={refreshToken}
        onOpenDetail={(id) => setRoute({ name: "detail", vehicleId: id })}
        onAdd={() => setRoute({ name: "add" })}
      />
    </View>
  );
}
