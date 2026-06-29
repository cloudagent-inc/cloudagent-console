import { resolveAssetPath } from "./iconCatalog";

export function getIconMap() {
  return {
    "generic.internet": {
      primary: resolveAssetPath("/icons/mvp/internet.svg"),
    },
  };
}

export const KIND_OPTIONS = [
  "generic.internet",
];
