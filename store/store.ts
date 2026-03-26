import dashboardSlice from "@/app/dashboard/(redux)/dashboard-slice";
import contractsSlice from "@/app/dashboard/contracts/(redux)/contracts-slice";
import hospitalOnboardingSlice from "@/app/dashboard/hospital-onboarding/(redux)/hospital-onboarding-slice";
import marketingSlice from "@/app/dashboard/marketing/(redux)/marketing-slice";
import ordersSlice from "@/app/dashboard/orders/(redux)/orders-slice";
import productsSlice from "@/app/dashboard/products/(redux)/products-slice";
import profileSlice from "@/app/dashboard/profile/(redux)/profile-slice";
import trainingsSlice from "@/app/dashboard/trainings/(redux)/trainings-slice";
import { configureStore } from "@reduxjs/toolkit";

export const store = configureStore({
  reducer: {
    products: productsSlice,
    orders: ordersSlice,
    profile: profileSlice,
    marketing: marketingSlice,
    contracts: contractsSlice,
    trainings: trainingsSlice,
    hospitalOnboarding: hospitalOnboardingSlice,
    dashboard: dashboardSlice,
  },
});

export type AppStore = typeof store;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
