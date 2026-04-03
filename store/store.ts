import dashboardSlice from "@/app/(dashboard)/dashboard/(redux)/dashboard-slice";
import accountsSlice from "@/app/(dashboard)/dashboard/accounts/(redux)/accounts-slice";
import activitiesSlice from "@/app/(dashboard)/dashboard/(redux)/activities-slice";
import contactsSlice from "@/app/(dashboard)/dashboard/(redux)/contacts-slice";
import tasksSlice from "@/app/(dashboard)/dashboard/tasks/(redux)/tasks-slice";
import usersSlice from "@/app/(dashboard)/dashboard/users/(redux)/users-slice";
import inviteTokensSlice from "@/app/(dashboard)/dashboard/onboarding/(redux)/invite-tokens-slice";
import contractsSlice from "@/app/(dashboard)/dashboard/contracts/(redux)/contracts-slice";
import hospitalOnboardingSlice from "@/app/(dashboard)/dashboard/hospital-onboarding/(redux)/hospital-onboarding-slice";
import marketingSlice from "@/app/(dashboard)/dashboard/marketing/(redux)/marketing-slice";
import ordersSlice from "@/app/(dashboard)/dashboard/orders/(redux)/orders-slice";
import productsSlice from "@/app/(dashboard)/dashboard/products/(redux)/products-slice";
import profileSlice from "@/app/(dashboard)/dashboard/profile/(redux)/profile-slice";
import trainingsSlice from "@/app/(dashboard)/dashboard/trainings/(redux)/trainings-slice";
import { configureStore } from "@reduxjs/toolkit";

export const store = configureStore({
  reducer: {
    accounts: accountsSlice,
    activities: activitiesSlice,
    contacts: contactsSlice,
    tasks: tasksSlice,
    users: usersSlice,
    inviteTokens: inviteTokensSlice,
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
