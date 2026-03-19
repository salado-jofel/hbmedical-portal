import { MaterialType } from "../(services)/actions";

interface MaterialsState {
  activeTab: MaterialType;
  isUploadModalOpen: boolean;
}

export const initialState: MaterialsState = {
  activeTab: "marketing",
  isUploadModalOpen: false,
};
